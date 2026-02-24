#!/usr/bin/env bun
import fs from 'node:fs/promises';
import path from 'node:path';
import { loadConfig, assertRunnableConfig } from './config.ts';
import { loadVaultMarkdown } from './vault.ts';
import { extractResearchTasks } from './intents.ts';
import { runResearch } from './research/index.ts';
import { writeFinding } from './writer.ts';
import { createLogger } from './logger.ts';
import {
  getTaskRecord,
  loadState,
  markTaskFailure,
  markTaskStarted,
  markTaskSuccess,
  saveState,
  shouldRunTask,
} from './state.ts';
import type { ResearchTask, RunStats, SignalForgeConfig, VaultNote } from './types.ts';

async function main(): Promise<void> {
  const config: SignalForgeConfig = loadConfig();
  assertRunnableConfig(config);
  const logger = createLogger({ json: config.json });

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
    const state = await loadState(config);
    const records = Object.values(state.tasks);
    const summary = {
      total: records.length,
      done: records.filter((item) => item.status === 'done').length,
      failed: records.filter((item) => item.status === 'failed').length,
      in_progress: records.filter((item) => item.status === 'in_progress').length,
      pending: records.filter((item) => item.status === 'pending').length,
      updatedAt: state.updatedAt,
      stateFile: config.stateFile,
    };
    logger.info('SignalForge status', summary);
    return;
  }

  const state = await loadState(config);
  const notes = await loadVaultMarkdown(config.vaultDir, config.since);
  const noteMap = new Map<string, VaultNote>(notes.map((note) => [note.relPath, note]));

  let tasks =
    config.command === 'rerun'
      ? resolveRerunTasks(config, notes)
      : extractResearchTasks(notes, config.maxTasks);

  if (tasks.length === 0) {
    logger.info('No research intents found. Add #investigate in your notes.');
    return;
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
    return;
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
    const record = getTaskRecord(state, task, note.mtimeMs);
    markTaskStarted(record, note.mtimeMs);
    await saveState(config, state);

    if (config.dryRun) {
      stats.processed += 1;
      stats.skipped += 1;
      logger.info('Dry run enabled, skipping research execution.', { query: task.query });
      continue;
    }

    try {
      const result = await runResearch(task, config, config.findingsDir);
      const outputPath = await writeFinding(config, task, result);
      markTaskSuccess(record, outputPath, note.mtimeMs);
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
  }

  stats.endedAt = new Date().toISOString();
  stats.durationMs = Date.parse(stats.endedAt) - Date.parse(stats.startedAt);
  logger.info('Run summary', { ...stats });
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[SignalForge] ${message}`);
  process.exit(1);
});

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
