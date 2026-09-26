import {
  BookmarkCheck,
  BookmarkPlus,
  CheckCircle2,
  Copy,
  Eraser,
  ExternalLink,
  FileJson,
  FileSpreadsheet,
  LocateFixed,
  MoreHorizontal,
  ScanSearch,
  Trash2,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import DomainManagerDialog from '../../components/DomainManagerDialog';
import DomainSelect from '../../components/DomainSelect';
import { parseDomainLines } from '../../core/domain-list';
import { normalizeTarget } from '../../core/domain-matcher';
import type {
  BackgroundRequest,
  BackgroundResponse,
  ContentRequest,
} from '../../shared/messages';
import { isDynamicScanMessage } from '../../shared/messages';
import type {
  PageMetadata,
  ResultFilter,
  SavedRecord,
  ScanPayload,
  ScanResult,
  TargetDomain,
} from '../../shared/types';
import {
  clearSavedRecords,
  getDomains,
  getSavedRecords,
  getStoredSelectedDomainId,
  replaceDomains,
  setStoredSelectedDomainId,
  toggleSavedRecord,
} from '../../storage/repository';

interface ContentResponse {
  ok: boolean;
  payload?: ScanPayload;
  error?: string;
}

const EMPTY_METADATA: PageMetadata = {
  title: '',
  url: '',
  noindex: false,
  pageNofollow: false,
};

const PLACEMENT_LABELS: Record<ScanResult['placement'], string> = {
  article: 'Article body',
  comment: 'Comments',
  navigation: 'Navigation',
  sidebar: 'Sidebar',
  footer: 'Footer',
  unknown: 'Page content',
};

const FILTERS: Array<{ id: ResultFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'link', label: 'Links' },
  { id: 'follow', label: 'Follow' },
  { id: 'nofollow', label: 'Nofollow' },
  { id: 'ugc', label: 'UGC' },
  { id: 'sponsored', label: 'Sponsored' },
  { id: 'text', label: 'Text' },
  { id: 'hidden', label: 'Hidden' },
  { id: 'redirect', label: 'Redirect' },
];

const matchesFilter = (result: ScanResult, filter: ResultFilter) => {
  if (filter === 'all') return true;
  if (filter === 'link' || filter === 'text') return result.type === filter;
  if (filter === 'hidden') return !result.visible;
  if (filter === 'redirect') return result.redirected;
  if (filter === 'nofollow') return result.rel.nofollow;
  if (filter === 'ugc') return result.rel.ugc;
  if (filter === 'sponsored') return result.rel.sponsored;
  return result.type === 'link' && !result.rel.nofollow && !result.rel.ugc && !result.rel.sponsored;
};

const primaryBadge = (result: ScanResult) => {
  if (result.type === 'text') return { label: 'Text only', className: 'badge-text' };
  if (result.rel.sponsored) return { label: 'Sponsored', className: 'badge-sponsored' };
  if (result.rel.ugc) return { label: 'UGC', className: 'badge-ugc' };
  if (result.rel.nofollow) return { label: 'Nofollow', className: 'badge-nofollow' };
  return { label: 'Follow', className: 'badge-follow' };
};

const relSummary = (result: ScanResult) => {
  if (result.type === 'text') return 'Brand mention';
  const flags = [
    result.rel.nofollow && 'nofollow',
    result.rel.ugc && 'ugc',
    result.rel.sponsored && 'sponsored',
  ].filter(Boolean);
  if (result.redirected) flags.push('redirect');
  return flags.length ? flags.join(' + ') : 'URL match';
};

const csvEscape = (value: unknown) => `"${String(value ?? '').replaceAll('"', '""')}"`;

const formatCsv = (results: ScanResult[], metadata: PageMetadata) => {
  const headers = [
    'page_title',
    'page_url',
    'type',
    'anchor_text',
    'destination_url',
    'redirect_target_url',
    'placement',
    'visible',
    'nofollow',
    'ugc',
    'sponsored',
    'context',
  ];
  const rows = results.map((result) => [
    metadata.title,
    metadata.url,
    result.type,
    result.anchorText,
    result.destinationUrl,
    result.redirectTargetUrl,
    result.placement,
    result.visible,
    result.rel.nofollow,
    result.rel.ugc,
    result.rel.sponsored,
    result.contextText,
  ]);
  return [headers, ...rows].map((row) => row.map(csvEscape).join(',')).join('\n');
};

const downloadFile = (content: string, filename: string, type: string) => {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
};

export default function App() {
  const [domains, setDomains] = useState<TargetDomain[]>([]);
  const [selectedDomainId, setSelectedDomainId] = useState('');
  const [domain, setDomain] = useState('');
  const [includeSubdomains, setIncludeSubdomains] = useState(true);
  const [domainManagerOpen, setDomainManagerOpen] = useState(false);
  const [domainDraft, setDomainDraft] = useState('');
  const [domainManagerError, setDomainManagerError] = useState('');
  const [activeTab, setActiveTab] = useState<chrome.tabs.Tab | null>(null);
  const [metadata, setMetadata] = useState<PageMetadata>(EMPTY_METADATA);
  const [results, setResults] = useState<ScanResult[]>([]);
  const [savedRecords, setSavedRecords] = useState<SavedRecord[]>([]);
  const [filter, setFilter] = useState<ResultFilter>('all');
  const [activeResultId, setActiveResultId] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [toast, setToast] = useState('');
  const [error, setError] = useState('');
  const toastTimer = useRef<number | undefined>(undefined);
  const menuRef = useRef<HTMLDivElement>(null);

  const showToast = useCallback((message: string) => {
    setToast(message);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(''), 1900);
  }, []);

  useEffect(() => {
    void Promise.all([
      getDomains(),
      getSavedRecords(),
      getStoredSelectedDomainId(),
      chrome.runtime.sendMessage<BackgroundRequest, BackgroundResponse>({ type: 'GET_ACTIVE_TAB' }),
    ]).then(([storedDomains, records, storedSelectedDomainId, tabResponse]) => {
      setDomains(storedDomains);
      setSavedRecords(records);
      const selected = storedDomains.find((item) => item.id === storedSelectedDomainId) ?? storedDomains[0];
      setSelectedDomainId(selected?.id ?? '');
      setDomain(selected?.domain ?? '');
      void setStoredSelectedDomainId(selected?.id ?? '');
      if (tabResponse.ok && tabResponse.tab) {
        setActiveTab(tabResponse.tab);
        setMetadata((current) => ({
          ...current,
          title: tabResponse.tab?.title ?? '',
          url: tabResponse.tab?.url ?? '',
        }));
      }
    });
  }, []);

  useEffect(() => {
    const listener = (message: unknown) => {
      if (!isDynamicScanMessage(message)) return;
      setResults(message.payload.results);
      setMetadata(message.payload.metadata);
      setLastChecked(new Date(message.payload.scannedAt));
      setActiveResultId(message.payload.results[0]?.id ?? null);
      showToast('Page changed · results refreshed');
    };
    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, [showToast]);

  useEffect(() => {
    if (!menuOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && !menuRef.current?.contains(event.target)) {
        setMenuOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [menuOpen]);

  const ensureScanner = useCallback(async (tab: chrome.tabs.Tab) => {
    if (!tab.id) throw new Error('No active tab is available.');
    let response = await chrome.runtime.sendMessage<BackgroundRequest, BackgroundResponse>({
      type: 'ENSURE_CONTENT_SCRIPT',
      tabId: tab.id,
    });
    if (!response.ok) throw new Error(response.message);
  }, []);

  const getCurrentTab = useCallback(async () => {
    const response = await chrome.runtime.sendMessage<BackgroundRequest, BackgroundResponse>({ type: 'GET_ACTIVE_TAB' });
    if (!response.ok || !response.tab?.id) throw new Error(response.ok ? 'No active tab is available.' : response.message);
    setActiveTab(response.tab);
    return response.tab;
  }, []);

  const sendToContent = useCallback(async (message: ContentRequest) => {
    const tab = await getCurrentTab();
    await ensureScanner(tab);
    return chrome.tabs.sendMessage<ContentRequest, ContentResponse>(tab.id!, message);
  }, [ensureScanner, getCurrentTab]);

  const handleScan = async () => {
    if (!domain.trim()) {
      setError('Please add a target domain first.');
      return;
    }
    if (!normalizeTarget(domain)) {
      setError('Enter a valid domain or full URL.');
      return;
    }
    setError('');
    setScanning(true);
    try {
      const response = await sendToContent({
        type: 'SCAN_PAGE',
        options: { target: domain, includeSubdomains, exactUrl: false },
      });
      if (!response.ok || !response.payload) throw new Error(response.error ?? 'The page scan failed.');
      setResults(response.payload.results);
      setMetadata(response.payload.metadata);
      setLastChecked(new Date(response.payload.scannedAt));
      setFilter('all');
      setActiveResultId(response.payload.results[0]?.id ?? null);
      showToast(`Found ${response.payload.results.length} matches for ${domain}`);
    } catch (scanError) {
      setError(scanError instanceof Error ? scanError.message : String(scanError));
    } finally {
      setScanning(false);
    }
  };

  const handleClear = async () => {
    try {
      await sendToContent({ type: 'CLEAR_HIGHLIGHTS' });
      setActiveResultId(null);
      showToast('Highlights cleared');
    } catch (clearError) {
      setError(clearError instanceof Error ? clearError.message : String(clearError));
    }
  };

  const handleLocate = async (result: ScanResult) => {
    setActiveResultId(result.id);
    try {
      await sendToContent({ type: 'LOCATE_RESULT', resultId: result.id });
    } catch (locateError) {
      setError(locateError instanceof Error ? locateError.message : String(locateError));
    }
  };

  const handleCopy = async (value: string) => {
    await navigator.clipboard.writeText(value);
    showToast('Copied to clipboard');
  };

  const handleSaveRecord = async (result: ScanResult) => {
    const record: SavedRecord = {
      ...result,
      recordId: crypto.randomUUID(),
      pageTitle: metadata.title,
      pageUrl: metadata.url,
      domainId: selectedDomainId || undefined,
      savedAt: new Date().toISOString(),
    };
    const state = await toggleSavedRecord(record);
    setSavedRecords(state.records);
    showToast(state.saved ? 'Saved to backlink records' : 'Removed from saved records');
  };

  const openDomainManager = useCallback(() => {
    setDomainDraft('');
    setDomainManagerError('');
    setDomainManagerOpen(true);
  }, []);

  const closeDomainManager = useCallback(() => {
    setDomainManagerOpen(false);
    setDomainManagerError('');
  }, []);

  const handleSaveDomains = useCallback(async () => {
    const parsed = parseDomainLines(domainDraft);
    if (parsed.invalid.length) {
      setDomainManagerError(`Invalid entries: ${parsed.invalid.slice(0, 3).join(', ')}`);
      return;
    }
    if (!parsed.domains.length) {
      setDomainManagerError('Add at least one valid domain.');
      return;
    }

    const savedDomainNames = domains.map((item) => item.domain);
    const savedDomainSet = new Set(savedDomainNames.map((item) => item.toLowerCase()));
    const additions = parsed.domains.filter((item) => !savedDomainSet.has(item.toLowerCase()));
    if (!additions.length) {
      setDomainManagerOpen(false);
      setDomainDraft('');
      showToast('Domains already saved');
      return;
    }

    const updated = await replaceDomains([...savedDomainNames, ...additions]);
    const selected = updated.find((item) => item.id === selectedDomainId) ?? updated[0];
    setDomains(updated);
    setSelectedDomainId(selected?.id ?? '');
    setDomain(selected?.domain ?? '');
    await setStoredSelectedDomainId(selected?.id ?? '');
    setDomainManagerOpen(false);
    setDomainDraft('');
    setDomainManagerError('');
    showToast(`${additions.length} ${additions.length === 1 ? 'domain' : 'domains'} added`);
  }, [domainDraft, domains, selectedDomainId, showToast]);

  const handleDeleteDomain = useCallback(async (domainId: string) => {
    const deleted = domains.find((item) => item.id === domainId);
    if (!deleted) return;

    const updated = await replaceDomains(
      domains.filter((item) => item.id !== domainId).map((item) => item.domain),
    );
    const selected = updated.find((item) => item.id === selectedDomainId) ?? updated[0];
    setDomains(updated);
    setSelectedDomainId(selected?.id ?? '');
    setDomain(selected?.domain ?? '');
    await setStoredSelectedDomainId(selected?.id ?? '');
    setError('');
    showToast(`${deleted.domain} removed`);
  }, [domains, selectedDomainId, showToast]);

  const handleExport = (format: 'json' | 'csv') => {
    const stamp = new Date().toISOString().slice(0, 10);
    if (format === 'json') {
      downloadFile(JSON.stringify({ metadata, target: domain, results }, null, 2), `backlink-scan-${stamp}.json`, 'application/json');
    } else {
      downloadFile(formatCsv(results, metadata), `backlink-scan-${stamp}.csv`, 'text/csv;charset=utf-8');
    }
    setMenuOpen(false);
    showToast(`${format.toUpperCase()} exported`);
  };

  const handleClearRecords = async () => {
    await clearSavedRecords();
    setSavedRecords([]);
    setMenuOpen(false);
    showToast('Saved records cleared');
  };

  const counts = useMemo(() => {
    const count = (candidate: ResultFilter) => results.filter((result) => matchesFilter(result, candidate)).length;
    return Object.fromEntries(FILTERS.map((item) => [item.id, count(item.id)])) as Record<ResultFilter, number>;
  }, [results]);

  const filteredResults = useMemo(
    () => results.filter((result) => matchesFilter(result, filter)),
    [filter, results],
  );
  const linkCount = results.filter((result) => result.type === 'link').length;
  const followCount = results.filter((result) => matchesFilter(result, 'follow')).length;
  const textCount = results.filter((result) => result.type === 'text').length;
  const activeHost = (() => {
    try {
      return new URL(metadata.url || activeTab?.url || '').hostname;
    } catch {
      return '';
    }
  })();
  const savedKeys = useMemo(
    () => new Set(savedRecords.map((record) => `${record.pageUrl}::${record.id}`)),
    [savedRecords],
  );
  const checkedLabel = lastChecked
    ? `Checked ${new Intl.RelativeTimeFormat('en', { numeric: 'auto' }).format(
        -Math.max(0, Math.round((Date.now() - lastChecked.getTime()) / 60_000)),
        'minute',
      )}`
    : 'Not scanned yet';

  return (
    <main className="panel-shell">
      <header className="panel-head">
        <div className="product">
          <img className="product-icon" src="/icon-48.png" alt="" />
          <div className="product-copy">
            <div className="product-name">Backlink Inspector</div>
            <div className="product-state" title={metadata.title || activeTab?.title}>
              <span className={`live-dot ${error ? 'is-error' : ''}`} />
              <span>{error ? 'Action needed' : activeHost ? `Ready on ${activeHost}` : 'Ready on this page'}</span>
            </div>
          </div>
        </div>
        <div className="menu-wrap" ref={menuRef}>
          <button className="icon-btn" type="button" aria-label="Panel menu" aria-expanded={menuOpen} aria-haspopup="menu" title="Panel menu" onClick={() => setMenuOpen((value) => !value)}>
            <MoreHorizontal size={18} />
          </button>
          {menuOpen && (
            <div className="panel-menu" role="menu">
              <button type="button" onClick={() => handleExport('json')} disabled={!results.length}><FileJson size={15} /> Export JSON</button>
              <button type="button" onClick={() => handleExport('csv')} disabled={!results.length}><FileSpreadsheet size={15} /> Export CSV</button>
              <div className="menu-divider" />
              <button type="button" onClick={handleClearRecords} disabled={!savedRecords.length}><Trash2 size={15} /> Clear saved records</button>
            </div>
          )}
        </div>
      </header>

      <section className="panel-body">
        <div className="domain-field">
          <div className="domain-field-label">
            <span>Target domain</span>
            <span>{domains.length} saved</span>
          </div>
          <DomainSelect
            domains={domains}
            selectedId={selectedDomainId}
            onSelect={(item) => {
              setSelectedDomainId(item.id);
              setDomain(item.domain);
              setError('');
              void setStoredSelectedDomainId(item.id);
            }}
            onManage={openDomainManager}
          />
        </div>

        <div className="options">
          <label className="check"><input type="checkbox" checked={includeSubdomains} onChange={(event) => setIncludeSubdomains(event.target.checked)} /> Include subdomains</label>
        </div>

        <div className="actions">
          <button className="btn btn-primary" type="button" onClick={handleScan} disabled={scanning}>
            {scanning ? <><span className="spinner" /> Scanning page…</> : <><ScanSearch size={16} /> Scan current page</>}
          </button>
          <button className="btn btn-icon" type="button" aria-label="Clear highlights" title="Clear highlights" onClick={handleClear}>
            <Eraser size={16} />
          </button>
        </div>
        {error && <div className="inline-error" role="alert">{error}</div>}

        <div className="divider" />

        <div className="scan-note">
          <strong>Scan results</strong>
          <span>{checkedLabel}</span>
        </div>
        <div className="stats" aria-live="polite">
          <div className="stat"><div className="stat-value">{results.length}</div><div className="stat-label">Matches</div></div>
          <div className="stat"><div className="stat-value">{linkCount}</div><div className="stat-label">Links</div></div>
          <div className="stat"><div className="stat-value">{followCount}</div><div className="stat-label">Follow</div></div>
          <div className="stat"><div className="stat-value">{textCount}</div><div className="stat-label">Text only</div></div>
        </div>

        {(metadata.noindex || metadata.pageNofollow) && (
          <div className="page-warning">
            {metadata.noindex && <span>Page noindex</span>}
            {metadata.pageNofollow && <span>Page nofollow</span>}
          </div>
        )}

        <div className="filters" role="group" aria-label="Filter findings">
          {FILTERS.filter((item) => item.id === 'all' || counts[item.id] > 0).map((item) => (
            <button
              className="filter"
              key={item.id}
              type="button"
              aria-pressed={filter === item.id}
              onClick={() => setFilter(item.id)}
            >
              {item.label} {counts[item.id]}
            </button>
          ))}
        </div>

        <div className="results" aria-live="polite">
          {filteredResults.map((result, index) => {
            const badge = primaryBadge(result);
            const copyValue = result.destinationUrl ?? result.anchorText ?? '';
            const saved = savedKeys.has(`${metadata.url}::${result.id}`);
            return (
              <article className={`result ${activeResultId === result.id ? 'is-active' : ''}`} key={result.id}>
                <div className="result-top">
                  <div className="result-title"><span className="result-index">{results.indexOf(result) + 1}</span><span>{result.type === 'link' ? 'External link' : 'Plain-text mention'}</span></div>
                  <span className={`badge ${badge.className}`}>{badge.label}</span>
                </div>
                <div className="result-body">
                  <div className="anchor" title={result.anchorText}>{result.anchorText || 'Image link'}</div>
                  <div className="url" title={result.destinationUrl}>{result.destinationUrl ?? 'No clickable destination'}</div>
                  <div className="meta">
                    <span>{PLACEMENT_LABELS[result.placement]}</span>
                    <span>{result.visible ? 'Visible' : 'Hidden'}</span>
                    <span>{relSummary(result)}</span>
                  </div>
                </div>
                <div className="result-actions">
                  <button type="button" className="mini-btn" onClick={() => handleLocate(result)}><LocateFixed size={14} /> Locate</button>
                  <button type="button" className="mini-btn" onClick={() => handleCopy(copyValue)}><Copy size={14} /> Copy</button>
                  {result.destinationUrl && (
                    <button type="button" className="mini-btn mini-icon" title="Open link" aria-label="Open link" onClick={() => chrome.tabs.create({ url: result.destinationUrl })}><ExternalLink size={14} /></button>
                  )}
                  <button type="button" className={`mini-btn ${saved ? 'is-saved' : ''}`} onClick={() => handleSaveRecord(result)}>
                    {saved ? <BookmarkCheck size={14} /> : <BookmarkPlus size={14} />} {saved ? 'Saved' : 'Save'}
                  </button>
                </div>
                {result.redirectTargetUrl && <div className="redirect-target">Resolves toward {result.redirectTargetUrl}</div>}
                <span className="sr-only">Result {index + 1}</span>
              </article>
            );
          })}
          {!filteredResults.length && (
            <div className="empty">
              <ScanSearch size={22} />
              <span>{results.length ? 'No findings match this filter.' : 'Scan this page to inspect backlinks.'}</span>
            </div>
          )}
        </div>

        <footer className="panel-footer">
          <span>{results.length} findings · DOM scan</span>
          <span>{savedRecords.length} saved · Local mode</span>
        </footer>
      </section>

      <DomainManagerDialog
        open={domainManagerOpen}
        domains={domains}
        selectedDomainId={selectedDomainId}
        value={domainDraft}
        error={domainManagerError}
        onChange={(value) => {
          setDomainDraft(value);
          setDomainManagerError('');
        }}
        onClose={closeDomainManager}
        onDelete={handleDeleteDomain}
        onSave={handleSaveDomains}
      />

      <div className={`toast ${toast ? 'is-visible' : ''}`} role="status" aria-live="polite">
        <CheckCircle2 size={15} /><span>{toast}</span>
      </div>
    </main>
  );
}
