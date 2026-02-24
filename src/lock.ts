import fs from 'node:fs/promises';
import path from 'node:path';

interface LockPayload {
  pid: number;
  startedAt: string;
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

    const existing = await readLock(lockFile);
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
    const existing = await readLock(lockFile);
    if (existing?.pid === process.pid) {
      await fs.rm(lockFile, { force: true });
    }
  };
}

async function readLock(lockFile: string): Promise<LockPayload | null> {
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

function isPidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}
