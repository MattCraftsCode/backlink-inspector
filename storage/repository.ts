import type { SavedRecord, TargetDomain } from '../shared/types';

const DOMAINS_KEY = 'backlinkInspector.domains';
const LEGACY_PROJECTS_KEY = 'backlinkInspector.projects';
const RECORDS_KEY = 'backlinkInspector.records';

const LEGACY_SEED_DATE = '2026-01-01T00:00:00.000Z';
const LEGACY_SEEDED_DOMAINS = new Set([
  'resizecraft:resizecraft.com',
  'fullmira:fullmira.com',
  'gamebodycam-wiki:gamebodycam.wiki',
]);

const removeLegacySeededDomains = (domains: TargetDomain[]) => domains.filter((item) => (
  item.createdAt !== LEGACY_SEED_DATE
  || !LEGACY_SEEDED_DOMAINS.has(`${item.id}:${item.domain.toLowerCase()}`)
));

export const getDomains = async () => {
  const stored = await chrome.storage.local.get([DOMAINS_KEY, LEGACY_PROJECTS_KEY]);
  const domains = stored[DOMAINS_KEY] as TargetDomain[] | undefined;
  if (domains) {
    const cleaned = removeLegacySeededDomains(domains);
    if (cleaned.length !== domains.length) {
      await chrome.storage.local.set({ [DOMAINS_KEY]: cleaned });
    }
    return cleaned;
  }

  const legacyProjects = stored[LEGACY_PROJECTS_KEY] as Array<{ id: string; domain: string; createdAt: string }> | undefined;
  const migrated = removeLegacySeededDomains(
    legacyProjects?.map(({ id, domain, createdAt }) => ({ id, domain, createdAt })) ?? [],
  );
  await chrome.storage.local.set({ [DOMAINS_KEY]: migrated });
  return migrated;
};

export const replaceDomains = async (values: string[]) => {
  const current = await getDomains();
  const byDomain = new Map(current.map((item) => [item.domain.toLowerCase(), item]));
  const updated: TargetDomain[] = values.map((domain) => {
    const existing = byDomain.get(domain.toLowerCase());
    return existing ?? {
      id: crypto.randomUUID(),
      domain,
      createdAt: new Date().toISOString(),
    };
  });
  await chrome.storage.local.set({ [DOMAINS_KEY]: updated });
  return updated;
};

export const getSavedRecords = async () => {
  const stored = await chrome.storage.local.get(RECORDS_KEY);
  return (stored[RECORDS_KEY] as SavedRecord[] | undefined) ?? [];
};

export const toggleSavedRecord = async (record: SavedRecord) => {
  const records = await getSavedRecords();
  const existingIndex = records.findIndex(
    (item) => item.pageUrl === record.pageUrl && item.id === record.id,
  );
  const saved = existingIndex === -1;
  if (saved) records.unshift(record);
  else records.splice(existingIndex, 1);
  await chrome.storage.local.set({ [RECORDS_KEY]: records.slice(0, 500) });
  return { saved, records };
};

export const clearSavedRecords = () => chrome.storage.local.set({ [RECORDS_KEY]: [] });
