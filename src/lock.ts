import fs from 'node:fs/promises';
import path from 'node:path';

interface LockPayload {
  pid: number;
  startedAt: string;
}

export interface StopLoopResult {
  stopped: boolean;
  pid?: number;
  reason: 'stopped' | 'not_running' | 'stale_lock_cleaned' | 'failed';
}

export async function acquireLoopLock(lockFile: string, staleMinutes: number): Promise<() => Promise<void>> {
  await fs.mkdir(path.dirname(lockFile), { recursive: true });
  const payload: LockPayload = {
    pid: process.pid,
    startedAt: new Date().toISOString(),
  };

  try {
    await fs.writeFile(lockFile, JSON.stringify(payload), { encoding: 'utf8', flag: 'wx' });
  } catch (error) {
    const isExists = error instanceof Error && 'code' in error && error.code === 'EEXIST';
    if (!isExists) {
      throw error;
    }

    const existing = await readLoopLock(lockFile);
    const staleMs = staleMinutes * 60_000;
    const isStale =
      !existing ||
      Date.now() - Date.parse(existing.startedAt) > staleMs ||
      !isPidAlive(existing.pid);

    if (!isStale) {
      throw new Error(`Loop lock is already held by pid ${existing.pid}.`);
    }

    await fs.rm(lockFile, { force: true });
    await fs.writeFile(lockFile, JSON.stringify(payload), { encoding: 'utf8', flag: 'wx' });
  }

  return async () => {
    const existing = await readLoopLock(lockFile);
    if (existing?.pid === process.pid) {
      await fs.rm(lockFile, { force: true });
    }
  };
}

export async function readLoopLock(lockFile: string): Promise<LockPayload | null> {
  try {
    const raw = await fs.readFile(lockFile, 'utf8');
    const parsed = JSON.parse(raw) as LockPayload;
    if (!parsed?.pid || !parsed?.startedAt) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function isPidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export async function stopLoopFromLock(lockFile: string, force = false): Promise<StopLoopResult> {
  const lock = await readLoopLock(lockFile);
  if (!lock) {
    return { stopped: false, reason: 'not_running' };
  }

  if (!isPidAlive(lock.pid)) {
    await fs.rm(lockFile, { force: true });
    return { stopped: false, pid: lock.pid, reason: 'stale_lock_cleaned' };
  }

  try {
    process.kill(lock.pid, force ? 'SIGKILL' : 'SIGTERM');
  } catch {
    return { stopped: false, pid: lock.pid, reason: 'failed' };
  }

  for (let i = 0; i < 30; i += 1) {
    if (!isPidAlive(lock.pid)) {
      await fs.rm(lockFile, { force: true });
      return { stopped: true, pid: lock.pid, reason: 'stopped' };
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  if (force) {
    return { stopped: false, pid: lock.pid, reason: 'failed' };
  }

  try {
    process.kill(lock.pid, 'SIGKILL');
    await fs.rm(lockFile, { force: true });
    return { stopped: true, pid: lock.pid, reason: 'stopped' };
  } catch {
    return { stopped: false, pid: lock.pid, reason: 'failed' };
  }
}
