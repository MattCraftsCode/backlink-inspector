import { describe, expect, it } from 'vitest';
import { findRedirectTarget, normalizeTarget, urlMatchesTarget } from './domain-matcher';

describe('domain matcher', () => {
  it('matches root domains and optional subdomains', () => {
    const target = normalizeTarget('resizecraft.com');
    expect(target).not.toBeNull();
    expect(urlMatchesTarget('https://resizecraft.com/tool', target!, false, false)).toBe(true);
    expect(urlMatchesTarget('https://app.resizecraft.com/tool', target!, false, false)).toBe(false);
    expect(urlMatchesTarget('https://app.resizecraft.com/tool', target!, true, false)).toBe(true);
  });

  it('supports exact URL matching', () => {
    const target = normalizeTarget('https://resizecraft.com/image-resizer?size=1200');
    expect(urlMatchesTarget('https://resizecraft.com/image-resizer?size=1200', target!, true, true)).toBe(true);
    expect(urlMatchesTarget('https://resizecraft.com/image-resizer?size=800', target!, true, true)).toBe(false);
  });

  it('detects common redirect parameters', () => {
    const target = normalizeTarget('resizecraft.com');
    const redirected = findRedirectTarget(
      'https://example.com/out?url=https%3A%2F%2Fresizecraft.com%2Ftool',
      target!,
      true,
      false,
    );
    expect(redirected).toBe('https://resizecraft.com/tool');
  });
});
