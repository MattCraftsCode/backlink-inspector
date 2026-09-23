import { normalizeTarget } from './domain-matcher';

export interface ParsedDomainLines {
  domains: string[];
  invalid: string[];
}

export const parseDomainLines = (value: string): ParsedDomainLines => {
  const domains: string[] = [];
  const invalid: string[] = [];
  const seen = new Set<string>();

  for (const rawLine of value.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const normalized = normalizeTarget(line);
    if (!normalized) {
      invalid.push(line);
      continue;
    }
    if (seen.has(normalized.hostname)) continue;
    seen.add(normalized.hostname);
    domains.push(normalized.hostname);
  }

  return { domains, invalid };
};
