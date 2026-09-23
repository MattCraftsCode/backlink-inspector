import { describe, expect, it } from 'vitest';
import { classifyPageAccess, getOptionalOriginPattern } from './page-access';

describe('page access', () => {
  it('does not treat a missing tab URL as a restricted Chrome page', () => {
    expect(classifyPageAccess(undefined)).toEqual({ kind: 'unknown' });
  });

  it('allows normal web pages', () => {
    expect(classifyPageAccess('https://example.com/article')).toEqual({ kind: 'inspectable' });
    expect(getOptionalOriginPattern('https://example.com/article')).toBe('https://example.com/*');
  });

  it('blocks Chrome internal and Web Store pages with specific messages', () => {
    expect(classifyPageAccess('chrome://extensions').kind).toBe('restricted');
    expect(classifyPageAccess('https://chromewebstore.google.com/detail/example').kind).toBe('restricted');
  });

  it('does not create host permission patterns for unsupported protocols', () => {
    expect(getOptionalOriginPattern('chrome://extensions')).toBeUndefined();
    expect(getOptionalOriginPattern('file:///tmp/example.html')).toBeUndefined();
  });
});
