import { findRedirectTarget, normalizeTarget, urlMatchesTarget } from '../core/domain-matcher';
import type { ContentRequest, DynamicScanMessage } from '../shared/messages';
import type { Placement, RelFlags, ScanOptions, ScanPayload, ScanResult } from '../shared/types';

declare global {
  interface Window {
    __backlinkInspectorInstalled?: boolean;
  }
}

interface LocatedResult {
  result: ScanResult;
  target: Element | Range;
}

const ROOT_ATTRIBUTE = 'data-backlink-inspector-root';
const HIGHLIGHT_ROOT_ID = '__backlink-inspector-overlay';
const MUTATION_DELAY = 450;

export default defineContentScript({
  registration: 'runtime',
  main() {
    if (window.__backlinkInspectorInstalled) return;
    window.__backlinkInspectorInstalled = true;

    let locatedResults = new Map<string, LocatedResult>();
    let lastOptions: ScanOptions | null = null;
    let selectedId: string | null = null;
    let mutationTimer: number | undefined;
    let renderFrame: number | undefined;
    let scanSequence = 0;
    let highlightsEnabled = true;

    const normalizeSpace = (value: string) => value.replace(/\s+/g, ' ').trim();
    const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    const getRoots = () => {
      const roots: Array<Document | ShadowRoot> = [document];
      const discover = (root: Document | ShadowRoot) => {
        for (const element of root.querySelectorAll('*')) {
          if (element.shadowRoot) {
            roots.push(element.shadowRoot);
            discover(element.shadowRoot);
          }
        }
      };
      discover(document);
      return roots;
    };

    const selectorFor = (element: Element) => {
      if (element.id) return `#${CSS.escape(element.id)}`;
      const parts: string[] = [];
      let current: Element | null = element;
      while (current && current !== document.documentElement && parts.length < 5) {
        let part = current.localName;
        const parent: Element | null = current.parentElement;
        if (parent) {
          const siblings = [...parent.children].filter((child) => child.localName === current?.localName);
          if (siblings.length > 1) part += `:nth-of-type(${siblings.indexOf(current) + 1})`;
        }
        parts.unshift(part);
        current = parent;
      }
      return parts.join(' > ');
    };

    const getPlacement = (element: Element | null): Placement => {
      if (!element) return 'unknown';
      if (element.closest('footer, [role="contentinfo"], [class*="footer" i], [id*="footer" i]')) return 'footer';
      if (element.closest('nav, [role="navigation"], [class*="nav" i], [class*="menu" i]')) return 'navigation';
      if (element.closest('aside, [class*="sidebar" i], [id*="sidebar" i]')) return 'sidebar';
      if (element.closest('[class*="comment" i], [id*="comment" i], [data-testid*="comment" i]')) return 'comment';
      if (element.closest('article, main, [role="main"], [class*="article" i], [class*="content" i]')) return 'article';
      return 'unknown';
    };

    const isVisible = (element: Element) => {
      const style = getComputedStyle(element);
      if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false;
      if (element.closest('[hidden], [aria-hidden="true"]')) return false;
      return element.getClientRects().length > 0;
    };

    const relFlags = (element: HTMLAnchorElement): RelFlags => {
      const values = new Set(element.rel.toLowerCase().split(/\s+/).filter(Boolean));
      return {
        nofollow: values.has('nofollow'),
        ugc: values.has('ugc'),
        sponsored: values.has('sponsored'),
        noopener: values.has('noopener'),
        noreferrer: values.has('noreferrer'),
      };
    };

    const contextFor = (element: Element) => {
      const context = element.closest('p, li, blockquote, article, section, div')?.textContent ?? element.textContent ?? '';
      return normalizeSpace(context).slice(0, 280);
    };

    const scanLinks = (options: ScanOptions, target: NonNullable<ReturnType<typeof normalizeTarget>>) => {
      const output: LocatedResult[] = [];
      const seen = new Set<HTMLAnchorElement>();
      for (const root of getRoots()) {
        for (const anchor of root.querySelectorAll<HTMLAnchorElement>('a[href]')) {
          if (seen.has(anchor) || anchor.closest(`[${ROOT_ATTRIBUTE}]`)) continue;
          seen.add(anchor);
          const href = anchor.href;
          const directMatch = urlMatchesTarget(href, target, options.includeSubdomains, options.exactUrl);
          const redirectTarget = directMatch
            ? undefined
            : findRedirectTarget(href, target, options.includeSubdomains, options.exactUrl);
          if (!directMatch && !redirectTarget) continue;

          const imageAlt = normalizeSpace(
            [...anchor.querySelectorAll('img[alt]')].map((image) => image.getAttribute('alt') ?? '').join(' '),
          );
          const anchorText = normalizeSpace(anchor.innerText || anchor.textContent || imageAlt || anchor.getAttribute('aria-label') || '');
          const rel = relFlags(anchor);
          const result: ScanResult = {
            id: `link-${output.length + 1}`,
            frameId: 0,
            type: 'link',
            matchReason: directMatch ? 'url' : 'redirect-url',
            destinationUrl: href,
            redirectTargetUrl: redirectTarget,
            rawHref: anchor.getAttribute('href') ?? undefined,
            anchorText: anchorText || imageAlt || href,
            imageAlt: imageAlt || undefined,
            rel,
            placement: getPlacement(anchor),
            visible: isVisible(anchor),
            external: anchor.hostname !== location.hostname,
            targetBlank: anchor.target === '_blank',
            contextText: contextFor(anchor),
            selector: selectorFor(anchor),
            redirected: Boolean(redirectTarget),
          };
          output.push({ result, target: anchor });
        }
      }
      return output;
    };

    const isExcludedTextNode = (node: Text) => {
      const parent = node.parentElement;
      if (!parent || !normalizeSpace(node.data)) return true;
      if (parent.closest(`a, script, style, noscript, textarea, input, select, option, [contenteditable="true"], [${ROOT_ATTRIBUTE}]`)) return true;
      return false;
    };

    const scanText = (targetDomain: string, includeSubdomains: boolean, startIndex: number) => {
      const output: LocatedResult[] = [];
      const domainPattern = includeSubdomains
        ? `(?:[a-z0-9-]+\\.)*${escapeRegExp(targetDomain)}`
        : escapeRegExp(targetDomain);
      const expression = new RegExp(`(^|[^a-z0-9-])(${domainPattern})(?=$|[^a-z0-9.-])`, 'ig');
      for (const root of getRoots()) {
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
          acceptNode: (node) => isExcludedTextNode(node as Text) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT,
        });
        let node: Node | null;
        while ((node = walker.nextNode())) {
          const text = (node as Text).data;
          expression.lastIndex = 0;
          let match: RegExpExecArray | null;
          while ((match = expression.exec(text))) {
            const value = match[2];
            if (!value) continue;
            const start = match.index + (match[1]?.length ?? 0);
            const range = document.createRange();
            range.setStart(node, start);
            range.setEnd(node, start + value.length);
            const parent = (node as Text).parentElement;
            if (!parent) continue;
            const result: ScanResult = {
              id: `text-${startIndex + output.length + 1}`,
              frameId: 0,
              type: 'text',
              matchReason: 'plain-text',
              anchorText: value,
              rel: { nofollow: false, ugc: false, sponsored: false, noopener: false, noreferrer: false },
              placement: getPlacement(parent),
              visible: isVisible(parent) && range.getClientRects().length > 0,
              external: false,
              targetBlank: false,
              contextText: contextFor(parent),
              selector: selectorFor(parent),
              redirected: false,
            };
            output.push({ result, target: range });
            if (output.length >= 200) return output;
          }
        }
      }
      return output;
    };

    const getMetadata = () => {
      const robots = (document.querySelector('meta[name="robots" i]')?.getAttribute('content') ?? '').toLowerCase();
      return {
        title: document.title,
        url: location.href,
        canonicalUrl: document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href,
        noindex: robots.split(/[,\s]+/).includes('noindex'),
        pageNofollow: robots.split(/[,\s]+/).includes('nofollow'),
      };
    };

    const colorFor = (result: ScanResult) => {
      if (result.type === 'text') return '#f2b705';
      if (result.rel.sponsored) return '#8b5cf6';
      if (result.rel.ugc) return '#3b82f6';
      if (result.rel.nofollow) return '#d97706';
      return '#0e9f6e';
    };

    const rectsFor = (target: Element | Range) => {
      const rectList = target instanceof Range ? target.getClientRects() : target.getClientRects();
      return [...rectList].filter((rect) => rect.width > 0 && rect.height > 0);
    };

    const getOverlayRoot = () => {
      let root = document.getElementById(HIGHLIGHT_ROOT_ID);
      if (root) return root;
      root = document.createElement('div');
      root.id = HIGHLIGHT_ROOT_ID;
      root.setAttribute(ROOT_ATTRIBUTE, 'true');
      Object.assign(root.style, {
        position: 'absolute',
        inset: '0',
        width: '0',
        height: '0',
        zIndex: '2147483647',
        pointerEvents: 'none',
      });
      document.documentElement.append(root);
      return root;
    };

    const clearHighlights = () => {
      highlightsEnabled = false;
      if (renderFrame) cancelAnimationFrame(renderFrame);
      document.getElementById(HIGHLIGHT_ROOT_ID)?.remove();
      selectedId = null;
    };

    const renderHighlights = () => {
      if (renderFrame) cancelAnimationFrame(renderFrame);
      renderFrame = requestAnimationFrame(() => {
        const previous = document.getElementById(HIGHLIGHT_ROOT_ID);
        previous?.remove();
        if (!highlightsEnabled || !locatedResults.size) return;
        const root = getOverlayRoot();
        for (const { result, target } of locatedResults.values()) {
          const color = colorFor(result);
          const rects = rectsFor(target);
          rects.forEach((rect, rectIndex) => {
            const highlight = document.createElement('div');
            highlight.setAttribute(ROOT_ATTRIBUTE, 'true');
            Object.assign(highlight.style, {
              position: 'absolute',
              left: `${rect.left + scrollX - 3}px`,
              top: `${rect.top + scrollY - 3}px`,
              width: `${rect.width + 6}px`,
              height: `${rect.height + 6}px`,
              border: `2px solid ${color}`,
              borderRadius: '5px',
              background: result.type === 'text' ? 'rgba(242, 183, 5, .22)' : 'transparent',
              boxShadow: selectedId === result.id ? `0 0 0 7px ${color}33` : `0 0 0 3px ${color}1f`,
              animation: selectedId === result.id ? '__biPulse 1.05s ease 2' : 'none',
            });
            if (selectedId === result.id && rectIndex === 0) {
              const badge = document.createElement('span');
              badge.textContent = String([...locatedResults.keys()].indexOf(result.id) + 1);
              Object.assign(badge.style, {
                position: 'absolute',
                left: '-13px',
                top: '-28px',
                display: 'grid',
                placeItems: 'center',
                width: '24px',
                height: '24px',
                border: '2px solid white',
                borderRadius: '50%',
                background: '#d23b51',
                color: 'white',
                boxShadow: '0 4px 12px rgba(0,0,0,.25)',
                font: '600 11px system-ui, sans-serif',
              });
              highlight.append(badge);
            }
            root.append(highlight);
          });
        }

        if (!document.getElementById('__biInspectorStyle')) {
          const style = document.createElement('style');
          style.id = '__biInspectorStyle';
          style.setAttribute(ROOT_ATTRIBUTE, 'true');
          style.textContent = '@keyframes __biPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.045)}}';
          document.documentElement.append(style);
        }
      });
    };

    const scan = (options: ScanOptions, dynamic = false): ScanPayload => {
      const target = normalizeTarget(options.target);
      if (!target) throw new Error('Enter a valid domain or URL.');
      scanSequence += 1;
      lastOptions = options;
      if (!dynamic) highlightsEnabled = true;
      const links = scanLinks(options, target);
      const text = scanText(target.hostname, options.includeSubdomains, links.length);
      locatedResults = new Map([...links, ...text].map((item) => [item.result.id, item]));
      selectedId = locatedResults.keys().next().value ?? null;
      renderHighlights();
      return {
        results: [...locatedResults.values()].map((item) => item.result),
        metadata: getMetadata(),
        scannedAt: new Date().toISOString(),
        dynamic,
      };
    };

    const locate = (resultId: string) => {
      const located = locatedResults.get(resultId);
      if (!located) return false;
      highlightsEnabled = true;
      selectedId = resultId;
      const element = located.target instanceof Range ? located.target.startContainer.parentElement : located.target;
      element?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
      window.setTimeout(renderHighlights, 360);
      return true;
    };

    const observer = new MutationObserver((records) => {
      if (!lastOptions) return;
      const isInspectorNode = (node: Node) => {
        const element = node instanceof Element ? node : node.parentElement;
        return Boolean(element?.matches(`[${ROOT_ATTRIBUTE}]`) || element?.closest(`[${ROOT_ATTRIBUTE}]`));
      };
      const relevant = records.some((record) => {
        if (record.type !== 'childList') return !isInspectorNode(record.target);
        return [...record.addedNodes, ...record.removedNodes].some((node) => !isInspectorNode(node));
      });
      if (!relevant) return;
      window.clearTimeout(mutationTimer);
      const sequenceAtSchedule = scanSequence;
      mutationTimer = window.setTimeout(() => {
        if (!lastOptions || sequenceAtSchedule !== scanSequence) return;
        try {
          const payload = scan(lastOptions, true);
          void chrome.runtime.sendMessage({ type: 'DYNAMIC_SCAN_RESULTS', payload } satisfies DynamicScanMessage).catch(() => undefined);
        } catch {
          // Ignore transient DOM states while an SPA is updating.
        }
      }, MUTATION_DELAY);
    });
    observer.observe(document.documentElement, { subtree: true, childList: true, characterData: true, attributes: true });

    const scheduleRender = () => renderHighlights();
    addEventListener('resize', scheduleRender, { passive: true });
    addEventListener('scroll', scheduleRender, { passive: true, capture: true });

    chrome.runtime.onMessage.addListener((message: ContentRequest, _sender, sendResponse) => {
      try {
        if (message.type === 'PING') sendResponse({ ok: true });
        if (message.type === 'SCAN_PAGE') sendResponse({ ok: true, payload: scan(message.options) });
        if (message.type === 'CLEAR_HIGHLIGHTS') {
          clearHighlights();
          sendResponse({ ok: true });
        }
        if (message.type === 'LOCATE_RESULT') sendResponse({ ok: locate(message.resultId) });
      } catch (error) {
        sendResponse({ ok: false, error: error instanceof Error ? error.message : String(error) });
      }
      return true;
    });
  },
});
