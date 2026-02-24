import { describe, expect, test } from 'bun:test';
import { purgeOrphanedTasks } from '../src/state.ts';
import type { StateFile } from '../src/types.ts';

function makeState(sourceFiles: string[]): StateFile {
  const tasks: StateFile['tasks'] = {};
  for (const sf of sourceFiles) {
    const key = `key-${sf}`;
    tasks[key] = {
      key,
      query: `query for ${sf}`,
      sourceFile: sf,
      status: 'done',
      attempts: 0,
    };
  }
  return { version: 1, updatedAt: new Date().toISOString(), tasks };
}

describe('purgeOrphanedTasks', () => {
  test('removes records for notes that no longer exist', () => {
    const state = makeState(['Notes/A.md', 'Notes/B.md', 'Notes/C.md']);
    const existing = new Set(['Notes/A.md']); // B and C deleted
    const result = purgeOrphanedTasks(state, existing);

    expect(result.removed).toBe(2);
    expect(result.kept).toBe(1);
    expect(Object.keys(state.tasks)).toHaveLength(1);
    expect(Object.values(state.tasks)[0].sourceFile).toBe('Notes/A.md');
  });

  test('does nothing when all notes still exist', () => {
    const state = makeState(['Notes/A.md', 'Notes/B.md']);
    const existing = new Set(['Notes/A.md', 'Notes/B.md']);
    const result = purgeOrphanedTasks(state, existing);

    expect(result.removed).toBe(0);
    expect(result.kept).toBe(2);
    expect(Object.keys(state.tasks)).toHaveLength(2);
  });

  test('clears everything when vault is empty', () => {
    const state = makeState(['Notes/A.md', 'Notes/B.md']);
    const result = purgeOrphanedTasks(state, new Set());

    expect(result.removed).toBe(2);
    expect(result.kept).toBe(0);
    expect(Object.keys(state.tasks)).toHaveLength(0);
  });

  test('handles empty state gracefully', () => {
    const state: StateFile = { version: 1, updatedAt: new Date().toISOString(), tasks: {} };
    const result = purgeOrphanedTasks(state, new Set(['Notes/A.md']));

    expect(result.removed).toBe(0);
    expect(result.kept).toBe(0);
  });
});
