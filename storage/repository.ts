import type { Project, SavedRecord } from '../shared/types';

const PROJECTS_KEY = 'backlinkInspector.projects';
const RECORDS_KEY = 'backlinkInspector.records';

const DEFAULT_PROJECTS: Project[] = [
  {
    id: 'resizecraft',
    name: 'ResizeCraft',
    domain: 'resizecraft.com',
    createdAt: new Date('2026-01-01T00:00:00.000Z').toISOString(),
  },
  {
    id: 'fullmira',
    name: 'Fullmira',
    domain: 'fullmira.com',
    createdAt: new Date('2026-01-01T00:00:00.000Z').toISOString(),
  },
  {
    id: 'gamebodycam-wiki',
    name: 'GameBodycam Wiki',
    domain: 'gamebodycam.wiki',
    createdAt: new Date('2026-01-01T00:00:00.000Z').toISOString(),
  },
];

export const getProjects = async () => {
  const stored = await chrome.storage.local.get(PROJECTS_KEY);
  const projects = stored[PROJECTS_KEY] as Project[] | undefined;
  if (projects?.length) return projects;
  await chrome.storage.local.set({ [PROJECTS_KEY]: DEFAULT_PROJECTS });
  return DEFAULT_PROJECTS;
};

export const saveProject = async (project: Omit<Project, 'id' | 'createdAt'>) => {
  const projects = await getProjects();
  const existing = projects.find((item) => item.domain.toLowerCase() === project.domain.toLowerCase());
  if (existing) return { project: existing, projects };
  const next: Project = {
    ...project,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  };
  const updated = [...projects, next];
  await chrome.storage.local.set({ [PROJECTS_KEY]: updated });
  return { project: next, projects: updated };
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
