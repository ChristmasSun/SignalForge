import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { extractResearchTasks } from './intents.ts';
import { acquireLoopLock, stopLoopFromLock } from './lock.ts';
import type { Logger } from './logger.ts';
import { runResearch as runResearchDefault } from './research/index.ts';
import {
  getTaskRecord,
  loadState,
  markTaskFailure,
  markTaskStarted,
  markTaskSuccess,
  purgeOrphanedTasks,
  saveState,
  shouldRunTask,
} from './state.ts';
import type { ResearchResult, ResearchTask, RunStats, SignalForgeConfig, VaultNote } from './types.ts';
import { loadVaultMarkdown as loadVaultMarkdownDefault } from './vault.ts';
import { writeFinding as writeFindingDefault } from './writer.ts';

interface RunnerDeps {
  loadVaultMarkdown: (vaultDir: string, since?: string) => Promise<VaultNote[]>;
  runResearch: (task: ResearchTask, config: SignalForgeConfig, outputDir: string) => Promise<ResearchResult>;
  writeFinding: (config: SignalForgeConfig, task: ResearchTask, result: ResearchResult) => Promise<string>;
  wait: (ms: number) => Promise<void>;
}

const defaultDeps: RunnerDeps = {
  loadVaultMarkdown: loadVaultMarkdownDefault,
  runResearch: runResearchDefault,
  writeFinding: writeFindingDefault,
  wait: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
};

export async function executeCommand(
  config: SignalForgeConfig,
  logger: Logger,
  deps: Partial<RunnerDeps> = {},
): Promise<void> {
  const resolvedDeps: RunnerDeps = { ...defaultDeps, ...deps };

  if (config.command === 'init') {
    await fs.mkdir(config.findingsDir, { recursive: true });
    await fs.mkdir(path.dirname(config.stateFile), { recursive: true });
    const state = await loadState(config);
    await saveState(config, state);
    logger.info('Initialized SignalForge workspace.', {
      findingsDir: config.findingsDir,
      stateFile: config.stateFile,
    });
    return;
  }

  if (config.command === 'status') {
    await showStatus(config, logger);
    return;
  }

  if (config.command === 'replay') {
    await showReplay(config, logger);
    return;
  }

  if (config.command === 'stop-loop') {
    await stopLoop(config, logger);
    return;
  }

  if (config.command === 'purge') {
    await runPurge(config, logger, resolvedDeps);
    return;
  }

  if (config.command === 'loop') {
    if (config.daemon) {
      await startLoopDaemon(config, logger);
      return;
    }
    await runLoop(config, logger, resolvedDeps);
    return;
  }

  await runOnce(config, logger, resolvedDeps);
}

async function runLoop(config: SignalForgeConfig, logger: Logger, deps: RunnerDeps): Promise<void> {
  const releaseLock = await acquireLoopLock(config.loopLockFile, config.lockStaleMinutes);
  logger.info('Acquired loop lock', { lockFile: config.loopLockFile, pid: process.pid });

  const maxCycles = config.loopMaxCycles ?? Number.MAX_SAFE_INTEGER;
  try {
    for (let cycle = 1; cycle <= maxCycles; cycle += 1) {
      logger.info('Starting loop cycle', { cycle, intervalMinutes: config.loopIntervalMinutes });
      const stats = await runOnce(config, logger, deps);
      await writeCycleSummary(config, cycle, stats);
      if (cycle < maxCycles) {
        await deps.wait(config.loopIntervalMinutes * 60_000);
      }
    }
  } finally {
    await releaseLock();
    logger.info('Released loop lock', { lockFile: config.loopLockFile, pid: process.pid });
  }
}

async function runOnce(config: SignalForgeConfig, logger: Logger, deps: RunnerDeps): Promise<RunStats> {
  const state = await loadState(config);
  const notes = await deps.loadVaultMarkdown(config.vaultDir, config.since);
  const noteMap = new Map<string, VaultNote>(notes.map((note) => [note.relPath, note]));

  let tasks =
    config.command === 'rerun'
      ? resolveRerunTasks(config, notes)
      : extractResearchTasks(notes, config.maxTasks);

  if (tasks.length === 0) {
    logger.info('No research intents found. Add #investigate in your notes.');
    return emptyStats();
  }

  if (config.command !== 'rerun') {
    tasks = tasks.filter((task) => {
      const note = noteMap.get(task.sourceFile);
      if (!note) {
        return false;
      }
      const record = getTaskRecord(state, task, note.mtimeMs);
      const decision = shouldRunTask(record, note, config, new Date().toISOString());
      if (!decision.run) {
        logger.info('Skipping task', { query: task.query, source: task.sourceFile, reason: decision.reason });
      }
      return decision.run;
    });
  }

  if (tasks.length === 0) {
    logger.info('No runnable tasks after state checks.');
    await saveState(config, state);
    return emptyStats();
  }

  const stats: RunStats = {
    startedAt: new Date().toISOString(),
    total: tasks.length,
    processed: 0,
    succeeded: 0,
    failed: 0,
    skipped: 0,
  };

  logger.info(`Found ${tasks.length} research task(s).`);

  for (const task of tasks) {
    const note =
      noteMap.get(task.sourceFile) ??
      (config.command === 'rerun'
        ? {
            filePath: path.join(config.vaultDir, task.sourceFile),
            relPath: task.sourceFile,
            content: '',
            mtimeMs: Date.now(),
          }
        : undefined);

    if (!note) {
      stats.skipped += 1;
      logger.warn('Skipping task with missing note', { query: task.query, source: task.sourceFile });
      continue;
    }

    logger.info('Investigating task', { query: task.query, source: task.sourceFile });
    if (config.dryRun) {
      stats.processed += 1;
      stats.skipped += 1;
      logger.info('Dry run enabled, skipping research execution.', { query: task.query });
      continue;
    }

    const record = getTaskRecord(state, task, note.mtimeMs);
    markTaskStarted(record, note.mtimeMs);
    await saveState(config, state);

    try {
      const result = await deps.runResearch(task, config, config.findingsDir);
      const outputPath = await deps.writeFinding(config, task, result);
      markTaskSuccess(record, outputPath, note.mtimeMs, result.artifacts);
      stats.processed += 1;
      stats.succeeded += 1;

      if (result.warning) {
        logger.warn('Research warning', { query: task.query, warning: result.warning });
      }

      logger.info('Wrote finding', {
        query: task.query,
        outputPath,
        mode: result.mode,
        confidence: result.confidence,
        llmSynthesized: result.llmSynthesized,
        liveView: result.artifacts.liveViewUrl,
        sessionId: result.artifacts.sessionId,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      markTaskFailure(record, message, config);
      stats.processed += 1;
      stats.failed += 1;
      logger.error('Task failed', { query: task.query, source: task.sourceFile, error: message });
    }

    await saveState(config, state);

    // Rate limit between tasks to avoid hammering search providers / LLM API
    if (stats.processed < tasks.length && config.rateLimitMs > 0) {
      await deps.wait(config.rateLimitMs);
    }
  }

  stats.endedAt = new Date().toISOString();
  stats.durationMs = Date.parse(stats.endedAt) - Date.parse(stats.startedAt);
  logger.info('Run summary', { ...stats });
  return stats;
}

async function showStatus(config: SignalForgeConfig, logger: Logger): Promise<void> {
  const state = await loadState(config);
  const records = Object.values(state.tasks);
  const summary = {
    total: records.length,
    done: records.filter((item) => item.status === 'done').length,
    failed: records.filter((item) => item.status === 'failed').length,
    in_progress: records.filter((item) => item.status === 'in_progress').length,
    pending: records.filter((item) => item.status === 'pending').length,
    with_session: records.filter((item) => Boolean(item.lastSessionId)).length,
    updatedAt: state.updatedAt,
    stateFile: config.stateFile,
  };
  logger.info('SignalForge status', summary);
}

async function showReplay(config: SignalForgeConfig, logger: Logger): Promise<void> {
  const token = config.commandArgs.join(' ').trim();
  if (!token) {
    throw new Error('replay requires query or session id. Example: signalforge replay "letta code"');
  }

  const state = await loadState(config);
  const record = Object.values(state.tasks).find(
    (item) => item.lastSessionId === token || item.query.toLowerCase() === token.toLowerCase(),
  );

  if (!record) {
    logger.warn('No replay match found.', { token });
    return;
  }

  logger.info('Replay details', {
    query: record.query,
    sessionId: record.lastSessionId ?? null,
    liveViewUrl: record.lastLiveViewUrl ?? null,
    replayUrl: record.lastReplayUrl ?? null,
    replayHint: record.lastReplayHint ?? null,
    findingPath: record.findingPath ?? null,
    lastSuccessAt: record.lastSuccessAt ?? null,
  });

  if (config.open) {
    const url = record.lastReplayUrl ?? record.lastLiveViewUrl ?? null;
    if (!url) {
      logger.warn('No openable URL available for replay.', { token });
      return;
    }
    await openUrl(url, logger);
  }
}

async function stopLoop(config: SignalForgeConfig, logger: Logger): Promise<void> {
  const result = await stopLoopFromLock(config.loopLockFile, config.force);
  if (result.reason === 'not_running') {
    logger.warn('No loop daemon is running.', { lockFile: config.loopLockFile });
    return;
  }

  if (result.reason === 'stale_lock_cleaned') {
    logger.info('Cleaned stale loop lock.', { lockFile: config.loopLockFile, pid: result.pid });
    return;
  }

  if (result.reason === 'stopped') {
    logger.info('Stopped loop daemon.', { lockFile: config.loopLockFile, pid: result.pid });
    return;
  }

  logger.error('Failed to stop loop daemon.', { lockFile: config.loopLockFile, pid: result.pid });
}

function resolveRerunTasks(config: SignalForgeConfig, notes: VaultNote[]): ResearchTask[] {
  const query = config.commandArgs.join(' ').trim();
  if (!query) {
    throw new Error('rerun requires a query. Example: signalforge rerun "letta code"');
  }

  const generated = extractResearchTasks(notes, Number.MAX_SAFE_INTEGER);
  const matches = generated.filter((task) => task.query.toLowerCase() === query.toLowerCase());
  if (matches.length > 0) {
    return matches.slice(0, config.maxTasks);
  }

  const source = notes[0]?.relPath ?? 'Manual.md';
  return [
    {
      query,
      sourceFile: source,
      reason: 'explicit_tag',
      sourceSnippet: `rerun:${query}`,
    },
  ];
}

async function writeCycleSummary(config: SignalForgeConfig, cycle: number, stats: RunStats): Promise<void> {
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const dir = path.join(config.findingsDir, 'Run Summaries');
  await fs.mkdir(dir, { recursive: true });
  const outputPath = path.join(dir, `${ts}-cycle-${cycle}.md`);
  const markdown = `---
type: signalforge_cycle_summary
cycle: ${cycle}
date: ${new Date().toISOString().slice(0, 10)}
---

# SignalForge Loop Cycle ${cycle}

- Total tasks: ${stats.total}
- Processed: ${stats.processed}
- Succeeded: ${stats.succeeded}
- Failed: ${stats.failed}
- Skipped: ${stats.skipped}
- Duration ms: ${stats.durationMs ?? 0}
- Started at: ${stats.startedAt}
- Ended at: ${stats.endedAt ?? ''}
`;
  await fs.writeFile(outputPath, markdown, 'utf8');
}

async function runPurge(config: SignalForgeConfig, logger: Logger, deps: RunnerDeps): Promise<void> {
  const state = await loadState(config);
  const notes = await deps.loadVaultMarkdown(config.vaultDir);
  const existingRelPaths = new Set(notes.map((note) => note.relPath));
  const result = purgeOrphanedTasks(state, existingRelPaths);

  if (result.removed === 0) {
    logger.info('No orphaned tasks found. State is clean.', { total: result.kept });
    return;
  }

  await saveState(config, state);
  logger.info('Purged orphaned task records.', {
    removed: result.removed,
    kept: result.kept,
    removedKeys: result.removedKeys,
  });
}

function emptyStats(): RunStats {
  const now = new Date().toISOString();
  return {
    startedAt: now,
    endedAt: now,
    durationMs: 0,
    total: 0,
    processed: 0,
    succeeded: 0,
    failed: 0,
    skipped: 0,
  };
}

async function startLoopDaemon(config: SignalForgeConfig, logger: Logger): Promise<void> {
  const cliPath = new URL('./cli.ts', import.meta.url).pathname;
  const args = ['run', cliPath, 'loop', `--interval-minutes=${config.loopIntervalMinutes}`];
  if (config.loopMaxCycles) {
    args.push(`--max-cycles=${config.loopMaxCycles}`);
  }
  args.push(`--lock-stale-minutes=${config.lockStaleMinutes}`);
  if (config.json) {
    args.push('--json');
  }
  if (config.dryRun) {
    args.push('--dry-run');
  }

  const child = spawn(process.execPath, args, {
    cwd: process.cwd(),
    detached: true,
    stdio: 'ignore',
    env: process.env,
  });
  child.unref();
  logger.info('Started loop daemon', { pid: child.pid, intervalMinutes: config.loopIntervalMinutes });
}

async function openUrl(url: string, logger: Logger): Promise<void> {
  const platform = process.platform;
  const command = platform === 'darwin' ? 'open' : platform === 'linux' ? 'xdg-open' : null;
  if (!command) {
    logger.warn('Auto-open is unsupported on this platform.', { platform, url });
    return;
  }

  await new Promise<void>((resolve) => {
    const child = spawn(command, [url], { stdio: 'ignore' });
    child.on('error', () => {
      logger.warn('Failed to open URL automatically.', { url, command });
      resolve();
    });
    child.on('exit', () => resolve());
  });
}
