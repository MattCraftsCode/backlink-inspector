import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getDomains,
  getStoredSelectedDomainId,
  setStoredSelectedDomainId,
} from './repository';

const DOMAINS_KEY = 'backlinkInspector.domains';
const LEGACY_PROJECTS_KEY = 'backlinkInspector.projects';
const SELECTED_DOMAIN_KEY = 'backlinkInspector.selectedDomainId';

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
          createdAt: '2025-06-01T00:00:00.000Z',
        },
        customDomain,
      ],
    });

    await expect(getDomains()).resolves.toEqual([customDomain]);
    expect(set).toHaveBeenCalledWith({ [DOMAINS_KEY]: [customDomain] });
  });

  it('reads and writes the selected domain id', async () => {
    get.mockResolvedValue({ [SELECTED_DOMAIN_KEY]: 'custom-domain' });

    await expect(getStoredSelectedDomainId()).resolves.toBe('custom-domain');
    await setStoredSelectedDomainId('next-domain');

    expect(get).toHaveBeenCalledWith(SELECTED_DOMAIN_KEY);
    expect(set).toHaveBeenCalledWith({ [SELECTED_DOMAIN_KEY]: 'next-domain' });
  });
});
