import { describe, expect, test } from 'bun:test';
import { dedupeByDomain, normalizeSource, rescoreWithContent } from '../src/research/sourceUtils.ts';

describe('source utils', () => {
  test('normalizeSource parses domain and drops invalid URLs', () => {
    const valid = normalizeSource({ title: 'Hello', url: 'https://example.com/a' });
    const invalid = normalizeSource({ title: 'X', url: 'not-a-url' });
    expect(valid?.domain).toBe('example.com');
    expect(invalid).toBeNull();
  });

  test('dedupeByDomain keeps strongest per domain', () => {
    const sources = [
      { title: 'a', url: 'https://a.com/1', domain: 'a.com', qualityScore: 0.2 },
      { title: 'b', url: 'https://a.com/2', domain: 'a.com', qualityScore: 0.9 },
      { title: 'c', url: 'https://c.com/1', domain: 'c.com', qualityScore: 0.3 },
    ];
    const deduped = dedupeByDomain(sources, 5);
    expect(deduped.length).toBe(2);
    expect(deduped[0].url).toBe('https://a.com/2');
  });

  test('rescoreWithContent rewards deeper content', () => {
    const source = {
      title: 'Doc',
      url: 'https://docs.example.com',
      domain: 'docs.example.com',
      qualityScore: 0.2,
      content: 'x'.repeat(3000),
    };
    const rescored = rescoreWithContent(source);
    expect(rescored.qualityScore).toBeGreaterThan(0.2);
  });
});
