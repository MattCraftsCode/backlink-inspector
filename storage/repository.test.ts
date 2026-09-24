import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getDomains } from './repository';

const DOMAINS_KEY = 'backlinkInspector.domains';
const LEGACY_PROJECTS_KEY = 'backlinkInspector.projects';
const LEGACY_SEED_DATE = '2026-01-01T00:00:00.000Z';

describe('domain storage', () => {
  const get = vi.fn();
  const set = vi.fn();

  beforeEach(() => {
    get.mockReset();
    set.mockReset().mockResolvedValue(undefined);
    vi.stubGlobal('chrome', { storage: { local: { get, set } } });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('starts without preset domains', async () => {
    get.mockResolvedValue({});

    await expect(getDomains()).resolves.toEqual([]);
    expect(get).toHaveBeenCalledWith([DOMAINS_KEY, LEGACY_PROJECTS_KEY]);
    expect(set).toHaveBeenCalledWith({ [DOMAINS_KEY]: [] });
  });

  it('removes only legacy seeded domains from existing storage', async () => {
    const customDomain = {
      id: 'custom-domain',
      domain: 'example.com',
      createdAt: '2026-09-24T00:00:00.000Z',
    };
    get.mockResolvedValue({
      [DOMAINS_KEY]: [
        {
          id: 'resizecraft',
          domain: 'resizecraft.com',
          createdAt: LEGACY_SEED_DATE,
        },
        customDomain,
      ],
    });

    await expect(getDomains()).resolves.toEqual([customDomain]);
    expect(set).toHaveBeenCalledWith({ [DOMAINS_KEY]: [customDomain] });
  });
});
