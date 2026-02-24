import { describe, expect, test } from 'bun:test';
import { extractResearchTasks } from '../src/intents.ts';
import type { VaultNote } from '../src/types.ts';

function makeNote(content: string): VaultNote {
  return {
    filePath: '/vault/Test.md',
    relPath: 'Test.md',
    content,
    mtimeMs: Date.now(),
  };
}

describe('extractResearchTasks', () => {
  test('extracts explicit #investigate tag', () => {
    const tasks = extractResearchTasks([makeNote('#investigate vector database comparison')]);
    expect(tasks.length).toBe(1);
    expect(tasks[0].query).toBe('vector database comparison');
    expect(tasks[0].reason).toBe('explicit_tag');
  });

  test('extracts heuristic phrase: read about', () => {
    const tasks = extractResearchTasks([makeNote('read about edge caching strategies')]);
    expect(tasks.length).toBe(1);
    expect(tasks[0].query).toContain('edge caching');
    expect(tasks[0].reason).toBe('heuristic_phrase');
  });

  test('extracts new heuristic: explore', () => {
    const tasks = extractResearchTasks([makeNote('explore Rust async runtimes')]);
    expect(tasks.length).toBe(1);
    expect(tasks[0].query).toContain('Rust async');
  });

  test('extracts new heuristic: dig into', () => {
    const tasks = extractResearchTasks([makeNote('dig into LLM fine-tuning costs')]);
    expect(tasks.length).toBe(1);
    expect(tasks[0].query).toContain('LLM fine-tuning');
  });

  test('extracts new heuristic: curious about', () => {
    const tasks = extractResearchTasks([makeNote('curious about WebAssembly performance')]);
    expect(tasks.length).toBe(1);
    expect(tasks[0].query).toContain('WebAssembly');
  });

  test('extracts new heuristic: how does X work', () => {
    const tasks = extractResearchTasks([makeNote('how does consistent hashing work')]);
    expect(tasks.length).toBe(1);
    expect(tasks[0].query).toContain('consistent hashing');
  });

  test('extracts new heuristic: what is', () => {
    const tasks = extractResearchTasks([makeNote('what is observability in distributed systems')]);
    expect(tasks.length).toBe(1);
    expect(tasks[0].query).toContain('observability');
  });

  test('deduplicates identical queries across lines', () => {
    const content = '#investigate serverless pricing\n#investigate serverless pricing';
    const tasks = extractResearchTasks([makeNote(content)]);
    expect(tasks.length).toBe(1);
  });

  test('deduplicates case-insensitively', () => {
    const content = '#investigate Serverless Pricing\n#investigate serverless pricing';
    const tasks = extractResearchTasks([makeNote(content)]);
    expect(tasks.length).toBe(1);
  });

  test('rejects too-short queries', () => {
    const tasks = extractResearchTasks([makeNote('#investigate ab')]);
    expect(tasks.length).toBe(0);
  });

  test('rejects queries starting with bad words', () => {
    const tasks = extractResearchTasks([makeNote('read about that thing over there')]);
    // "that" is a bad start word so query "that thing over there" should be rejected
    expect(tasks.every((t) => !t.query.toLowerCase().startsWith('that'))).toBe(true);
  });

  test('respects maxTasks limit', () => {
    const content = Array.from({ length: 10 }, (_, i) => `#investigate topic ${i}`).join('\n');
    const tasks = extractResearchTasks([makeNote(content)], 3);
    expect(tasks.length).toBe(3);
  });

  test('does not extract #investigate inside heuristic pass', () => {
    // Heuristic pass should skip lines that contain #investigate
    const tasks = extractResearchTasks([makeNote('#investigate something useful')]);
    // Should be captured by explicit, not duplicated by heuristic
    expect(tasks.length).toBe(1);
  });
});
