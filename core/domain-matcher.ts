const HTTP_PROTOCOLS = new Set(['http:', 'https:']);

export interface NormalizedTarget {
  hostname: string;
  exactUrl?: string;
  displayValue: string;
}

const normalizeHostname = (hostname: string) => hostname.toLowerCase().replace(/^www\./, '').replace(/\.$/, '');

export const normalizeTarget = (input: string): NormalizedTarget | null => {
  const value = input.trim();
  if (!value) return null;

  try {
    const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
    if (!HTTP_PROTOCOLS.has(url.protocol)) return null;
    const hostname = normalizeHostname(url.hostname);
    if (!hostname || !hostname.includes('.')) return null;
    const hasExplicitPath = /^https?:\/\//i.test(value) && (url.pathname !== '/' || Boolean(url.search) || Boolean(url.hash));
    return {
      hostname,
      exactUrl: hasExplicitPath ? canonicalizeUrl(url.href) : undefined,
      displayValue: value,
    };
  } catch {
    return null;
  }
};

export const canonicalizeUrl = (value: string) => {
  const url = new URL(value);
  url.hostname = normalizeHostname(url.hostname);
  if (url.pathname !== '/') url.pathname = url.pathname.replace(/\/$/, '');
  return url.href;
};

export const hostnameMatches = (hostname: string, target: string, includeSubdomains: boolean) => {
  const normalized = normalizeHostname(hostname);
  return normalized === target || (includeSubdomains && normalized.endsWith(`.${target}`));
};

export const urlMatchesTarget = (
  href: string,
  target: NormalizedTarget,
  includeSubdomains: boolean,
  exactUrl: boolean,
) => {
  try {
    const url = new URL(href);
    if (!HTTP_PROTOCOLS.has(url.protocol)) return false;
    if (exactUrl) {
      const expected = target.exactUrl ?? canonicalizeUrl(`https://${target.hostname}/`);
      return canonicalizeUrl(url.href) === expected;
    }
    return hostnameMatches(url.hostname, target.hostname, includeSubdomains);
  } catch {
    return false;
  }
};

const REDIRECT_PARAM_NAMES = new Set([
  'url',
  'u',
  'target',
  'dest',
  'destination',
  'redirect',
  'redirect_url',
  'redirect_uri',
  'to',
  'out',
]);

export const findRedirectTarget = (
  href: string,
  target: NormalizedTarget,
  includeSubdomains: boolean,
  exactUrl: boolean,
) => {
  try {
    const url = new URL(href);
    for (const [name, rawValue] of url.searchParams) {
      if (!REDIRECT_PARAM_NAMES.has(name.toLowerCase())) continue;
      const candidates = [rawValue];
      try {
        candidates.push(decodeURIComponent(rawValue));
      } catch {
        // The raw parameter may already be decoded.
      }
      for (const candidate of candidates) {
        const absolute = /^https?:\/\//i.test(candidate) ? candidate : `https://${candidate.replace(/^\/+/, '')}`;
        if (urlMatchesTarget(absolute, target, includeSubdomains, exactUrl)) return absolute;
      }
    }
  } catch {
    return undefined;
  }
  return undefined;
};
