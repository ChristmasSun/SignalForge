import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import type {
  ResearchTask,
  SignalForgeConfig,
  StateFile,
  TaskStateRecord,
  VaultNote,
} from './types.ts';

const EMPTY_STATE: StateFile = {
  version: 1,
  updatedAt: new Date(0).toISOString(),
  tasks: {},
};

export async function loadState(config: SignalForgeConfig): Promise<StateFile> {
  try {
    const raw = await fs.readFile(config.stateFile, 'utf8');
    const parsed = JSON.parse(raw) as StateFile;
    if (parsed?.version !== 1 || !parsed.tasks) {
      return structuredClone(EMPTY_STATE);
    }
    return parsed;
  } catch {
    return structuredClone(EMPTY_STATE);
  }
}

export async function saveState(config: SignalForgeConfig, state: StateFile): Promise<void> {
  state.updatedAt = new Date().toISOString();
  await fs.mkdir(path.dirname(config.stateFile), { recursive: true });
  await fs.writeFile(config.stateFile, JSON.stringify(state, null, 2), 'utf8');
}

export function taskKey(task: ResearchTask): string {
  return crypto.createHash('sha1').update(`${task.sourceFile}::${task.query.toLowerCase()}`).digest('hex');
}

export function getTaskRecord(
  state: StateFile,
  task: ResearchTask,
  noteMtimeMs: number,
): TaskStateRecord {
  const key = taskKey(task);
  const current = state.tasks[key];
  if (current) {
    return current;
  }

  const record: TaskStateRecord = {
    key,
    query: task.query,
    sourceFile: task.sourceFile,
    status: 'pending',
    attempts: 0,
    lastNoteMtimeMs: noteMtimeMs,
  };
  state.tasks[key] = record;
  return record;
}

export function shouldRunTask(
  record: TaskStateRecord,
  note: VaultNote,
  config: SignalForgeConfig,
  nowIso: string,
): { run: boolean; reason?: string } {
  if (config.force) {
    return { run: true };
  }

  if (record.status === 'done' && record.lastNoteMtimeMs && note.mtimeMs <= record.lastNoteMtimeMs) {
    return { run: false, reason: 'up_to_date' };
  }

  if (record.status === 'failed' && record.nextRetryAt && record.nextRetryAt > nowIso) {
    return { run: false, reason: 'backoff_active' };
  }

  if (record.attempts >= config.maxRetries && record.status === 'failed') {
    return { run: false, reason: 'max_retries_reached' };
  }

  return { run: true };
}

export function markTaskStarted(record: TaskStateRecord, noteMtimeMs: number): void {
  record.status = 'in_progress';
  record.lastRunAt = new Date().toISOString();
  record.lastNoteMtimeMs = noteMtimeMs;
}

export function markTaskSuccess(
  record: TaskStateRecord,
  findingPath: string,
  noteMtimeMs: number,
  artifacts?: {
    sessionId: string | null;
    liveViewUrl: string | null;
    replayUrl: string | null;
    replayHint: string | null;
  },
): void {
  record.status = 'done';
  record.attempts = 0;
  record.lastSuccessAt = new Date().toISOString();
  record.lastError = undefined;
  record.nextRetryAt = undefined;
  record.findingPath = findingPath;
  record.lastSessionId = artifacts?.sessionId ?? null;
  record.lastLiveViewUrl = artifacts?.liveViewUrl ?? null;
  record.lastReplayUrl = artifacts?.replayUrl ?? null;
  record.lastReplayHint = artifacts?.replayHint ?? null;
  record.lastNoteMtimeMs = noteMtimeMs;
}

export function markTaskFailure(record: TaskStateRecord, errorMessage: string, config: SignalForgeConfig): void {
  record.status = 'failed';
  record.attempts += 1;
  record.lastFailureAt = new Date().toISOString();
  record.lastError = errorMessage;

  const minutes = Math.min(config.retryBaseMinutes * 2 ** (record.attempts - 1), 24 * 60);
  const next = Date.now() + minutes * 60_000;
  record.nextRetryAt = new Date(next).toISOString();
}
