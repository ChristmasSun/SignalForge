import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { writeFinding } from '../src/writer.ts';
import type { ResearchResult, ResearchTask, SignalForgeConfig } from '../src/types.ts';

let tempDir = '';

beforeEach(async () => {
  tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'signalforge-writer-it-'));
  await fs.mkdir(path.join(tempDir, 'Inbox', 'Findings'), { recursive: true });
  await fs.mkdir(path.join(tempDir, 'Projects'), { recursive: true });
  await fs.writeFile(path.join(tempDir, 'Projects', 'Alpha.md'), '#investigate Letta code\n', 'utf8');
});

afterEach(async () => {
  if (tempDir) {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
});

describe('writer integration', () => {
  test('writes finding markdown and inserts backlink section', async () => {
    const config: SignalForgeConfig = {
      command: 'run',
      commandArgs: [],
      dryRun: false,
      json: false,
      daemon: false,
      open: false,
      force: false,
      since: undefined,
      vaultDir: tempDir,
      findingsDir: path.join(tempDir, 'Inbox', 'Findings'),
      stateFile: path.join(tempDir, '.signalforge', 'state.json'),
      loopLockFile: path.join(tempDir, '.signalforge', 'loop.lock'),
      lockStaleMinutes: 180,
      maxTasks: 5,
      maxSourcesPerTask: 3,
      maxRetries: 4,
      retryBaseMinutes: 5,
      rateLimitMs: 0,
      loopIntervalMinutes: 60,
      loopMaxCycles: undefined,
      browserbase: {},
      providers: {},
      cerebras: { model: 'gpt-oss-120b' },
    };

    const task: ResearchTask = {
      query: 'Letta code',
      sourceFile: 'Projects/Alpha.md',
      reason: 'explicit_tag',
      sourceSnippet: '#investigate Letta code',
    };

    const result: ResearchResult = {
      mode: 'browserbase',
      summary: 'summary',
      insights: ['insight [1]'],
      citations: ['[1] Letta Docs - https://example.com/docs'],
      sources: [
        {
          title: 'Letta Docs',
          url: 'https://example.com/docs',
          domain: 'example.com',
          qualityScore: 0.9,
          content: 'text',
        },
      ],
      artifacts: {
        sessionId: 's_1',
        liveViewUrl: 'https://live.example.com',
        replayUrl: 'https://replay.example.com',
        replayHint: 'hint',
        screenshots: [],
      },
      confidence: 0.88,
      confidenceReasons: ['reason'],
      openQuestions: ['What is the main use case?'],
      llmSynthesized: true,
      warning: undefined,
    };

    const findingPath = await writeFinding(config, task, result);
    const findingContent = await fs.readFile(findingPath, 'utf8');
    expect(findingContent).toContain('Replay URL: https://replay.example.com');
    expect(findingContent).toContain('## Key insights');
    expect(findingContent).toContain('project: "projects"');

    const noteContent = await fs.readFile(path.join(tempDir, 'Projects', 'Alpha.md'), 'utf8');
    expect(noteContent).toContain('## SignalForge Findings');
    expect(noteContent).toContain('Inbox/Findings/');
  });
});
