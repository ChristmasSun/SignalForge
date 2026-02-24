import { describe, expect, test } from 'bun:test';
import { markTaskFailure, markTaskSuccess, shouldRunTask } from '../src/state.ts';
import type { SignalForgeConfig, TaskStateRecord, VaultNote } from '../src/types.ts';

const baseConfig: SignalForgeConfig = {
  command: 'run',
  commandArgs: [],
  dryRun: false,
  json: false,
  force: false,
  vaultDir: '/tmp/vault',
  findingsDir: '/tmp/vault/Inbox/Findings',
  stateFile: '/tmp/vault/.signalforge/state.json',
  maxTasks: 5,
  maxSourcesPerTask: 3,
  maxRetries: 4,
  retryBaseMinutes: 5,
  browserbase: {},
  providers: {},
};

const note: VaultNote = {
  filePath: '/tmp/vault/Test.md',
  relPath: 'Test.md',
  content: 'test',
  mtimeMs: Date.now(),
};

describe('state helpers', () => {
  test('backoff prevents immediate rerun', () => {
    const record: TaskStateRecord = {
      key: 'k',
      query: 'q',
      sourceFile: 'Test.md',
      status: 'pending',
      attempts: 0,
    };

    markTaskFailure(record, 'boom', baseConfig);
    const decision = shouldRunTask(record, note, baseConfig, new Date().toISOString());
    expect(decision.run).toBe(false);
    expect(decision.reason).toBe('backoff_active');
  });

  test('success resets attempts and retry state', () => {
    const record: TaskStateRecord = {
      key: 'k',
      query: 'q',
      sourceFile: 'Test.md',
      status: 'failed',
      attempts: 2,
      nextRetryAt: new Date(Date.now() + 600_000).toISOString(),
    };

    markTaskSuccess(record, 'finding.md', note.mtimeMs);
    expect(record.status).toBe('done');
    expect(record.attempts).toBe(0);
    expect(record.nextRetryAt).toBeUndefined();
  });
});
