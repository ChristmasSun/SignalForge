import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { executeCommand } from '../src/runner.ts';
import { loadState } from '../src/state.ts';
import type { Logger } from '../src/logger.ts';
import type { ResearchResult, SignalForgeConfig } from '../src/types.ts';
import { loadVaultMarkdown } from '../src/vault.ts';

let tempDir = '';

beforeEach(async () => {
  tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'signalforge-it-'));
  await fs.mkdir(path.join(tempDir, 'Inbox', 'Findings'), { recursive: true });
  await fs.writeFile(path.join(tempDir, 'Ideas.md'), '#investigate Letta code\n', 'utf8');
});

afterEach(async () => {
  if (tempDir) {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
});

describe('runner integration', () => {
  test('run updates state and skips unchanged tasks on second run', async () => {
    const logs: Array<{ level: string; message: string; meta?: Record<string, unknown> }> = [];
    const logger: Logger = {
      info: (message, meta) => logs.push({ level: 'info', message, meta }),
      warn: (message, meta) => logs.push({ level: 'warn', message, meta }),
      error: (message, meta) => logs.push({ level: 'error', message, meta }),
    };

    const baseConfig = makeConfig(tempDir, 'run');
    await executeCommand(baseConfig, logger, {
      loadVaultMarkdown,
      runResearch: async () => mockResearchResult(),
      writeFinding: async (_config, task) => {
        const out = path.join(tempDir, 'Inbox', 'Findings', `${task.query}.md`);
        await fs.writeFile(out, `# ${task.query}\n`, 'utf8');
        return out;
      },
    });

    const firstState = await loadState(baseConfig);
    const records = Object.values(firstState.tasks);
    expect(records.length).toBe(1);
    expect(records[0].status).toBe('done');
    expect(records[0].lastSessionId).toBe('s_123');
    expect(records[0].lastReplayUrl).toBe('https://replay.example.com');

    await executeCommand(baseConfig, logger, {
      loadVaultMarkdown,
      runResearch: async () => {
        throw new Error('should not be called for unchanged note');
      },
      writeFinding: async () => {
        throw new Error('should not be called for unchanged note');
      },
    });

    const hasSkip = logs.some((entry) => entry.message === 'Skipping task');
    expect(hasSkip).toBe(true);
  });

  test('replay command surfaces last session details', async () => {
    const logs: Array<{ level: string; message: string; meta?: Record<string, unknown> }> = [];
    const logger: Logger = {
      info: (message, meta) => logs.push({ level: 'info', message, meta }),
      warn: (message, meta) => logs.push({ level: 'warn', message, meta }),
      error: (message, meta) => logs.push({ level: 'error', message, meta }),
    };

    const runConfig = makeConfig(tempDir, 'run');
    await executeCommand(runConfig, logger, {
      loadVaultMarkdown,
      runResearch: async () => mockResearchResult(),
      writeFinding: async (_config, task) => {
        const out = path.join(tempDir, 'Inbox', 'Findings', `${task.query}.md`);
        await fs.writeFile(out, `# ${task.query}\n`, 'utf8');
        return out;
      },
    });

    const replayConfig = makeConfig(tempDir, 'replay', ['letta code']);
    await executeCommand(replayConfig, logger);
    const replayLog = logs.find((entry) => entry.message === 'Replay details');
    expect(replayLog).toBeTruthy();
    expect(replayLog?.meta?.sessionId).toBe('s_123');
    expect(replayLog?.meta?.replayUrl).toBe('https://replay.example.com');
  });

  test('loop writes cycle summary output', async () => {
    const logs: Array<{ level: string; message: string; meta?: Record<string, unknown> }> = [];
    const logger: Logger = {
      info: (message, meta) => logs.push({ level: 'info', message, meta }),
      warn: (message, meta) => logs.push({ level: 'warn', message, meta }),
      error: (message, meta) => logs.push({ level: 'error', message, meta }),
    };

    const loopConfig = {
      ...makeConfig(tempDir, 'loop'),
      dryRun: true,
      loopMaxCycles: 1,
      loopIntervalMinutes: 1,
    };

    await executeCommand(loopConfig, logger, {
      loadVaultMarkdown,
      runResearch: async () => mockResearchResult(),
      writeFinding: async (_config, task) => {
        const out = path.join(tempDir, 'Inbox', 'Findings', `${task.query}.md`);
        await fs.writeFile(out, `# ${task.query}\n`, 'utf8');
        return out;
      },
    });

    const summaryDir = path.join(tempDir, 'Inbox', 'Findings', 'Run Summaries');
    const files = await fs.readdir(summaryDir);
    expect(files.length).toBeGreaterThan(0);
  });
});

function makeConfig(vaultDir: string, command: string, commandArgs: string[] = []): SignalForgeConfig {
  return {
    command,
    commandArgs,
    dryRun: false,
    json: false,
    daemon: false,
    open: false,
    force: false,
    since: undefined,
    vaultDir,
    findingsDir: path.join(vaultDir, 'Inbox', 'Findings'),
    stateFile: path.join(vaultDir, '.signalforge', 'state.json'),
    loopLockFile: path.join(vaultDir, '.signalforge', 'loop.lock'),
    lockStaleMinutes: 180,
    maxTasks: 5,
    maxSourcesPerTask: 3,
    maxRetries: 4,
    retryBaseMinutes: 1,
    loopIntervalMinutes: 60,
    loopMaxCycles: undefined,
    browserbase: {},
    providers: {},
  };
}

function mockResearchResult(): ResearchResult {
  return {
    mode: 'fallback',
    summary: 'summary',
    insights: ['insight [1]'],
    citations: ['[1] title - https://example.com'],
    confidence: 0.77,
    confidenceReasons: ['reason'],
    warning: undefined,
    sources: [
      {
        title: 'title',
        url: 'https://example.com',
        domain: 'example.com',
        qualityScore: 0.8,
        content: 'content',
      },
    ],
    artifacts: {
      sessionId: 's_123',
      liveViewUrl: 'https://live.example.com',
      replayUrl: 'https://replay.example.com',
      replayHint: 'hint',
      screenshots: [],
    },
  };
}
