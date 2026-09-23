import { describe, expect, it } from 'vitest';
import { classifyPageAccess } from './page-access';

describe('page access', () => {
  it('does not treat a missing tab URL as a restricted Chrome page', () => {
    expect(classifyPageAccess(undefined)).toEqual({ kind: 'unknown' });
  });

  it('allows normal web pages', () => {
    expect(classifyPageAccess('https://example.com/article')).toEqual({ kind: 'inspectable' });
  });

  it('blocks Chrome internal and Web Store pages with specific messages', () => {
    expect(classifyPageAccess('chrome://extensions').kind).toBe('restricted');
    expect(classifyPageAccess('https://chromewebstore.google.com/detail/example').kind).toBe('restricted');
  });
});
