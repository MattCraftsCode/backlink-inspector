import { describe, expect, it } from 'vitest';
import { parseDomainLines } from './domain-list';

describe('domain list parser', () => {
  it('normalizes URLs to domains and removes duplicates', () => {
    expect(parseDomainLines('ResizeCraft.com\nhttps://www.resizecraft.com/tool\nfullmira.com')).toEqual({
      domains: ['resizecraft.com', 'fullmira.com'],
      invalid: [],
    });
  });

  it('reports invalid non-empty lines', () => {
    expect(parseDomainLines('example.com\nnot a domain\n\nlocalhost')).toEqual({
      domains: ['example.com'],
      invalid: ['not a domain', 'localhost'],
    });
  });
});
