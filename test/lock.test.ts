import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { acquireLoopLock, stopLoopFromLock } from '../src/lock.ts';

let tempDir = '';

beforeEach(async () => {
  tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'signalforge-lock-it-'));
});

afterEach(async () => {
  if (tempDir) {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
});

describe('loop lock', () => {
  test('prevents concurrent acquisition and releases cleanly', async () => {
    const lockFile = path.join(tempDir, 'loop.lock');
    const release = await acquireLoopLock(lockFile, 60);

    await expect(acquireLoopLock(lockFile, 60)).rejects.toThrow('Loop lock is already held');
    await release();

    const releaseAgain = await acquireLoopLock(lockFile, 60);
    await releaseAgain();
  });

  test('stopLoopFromLock terminates running process and removes lock', async () => {
    const lockFile = path.join(tempDir, 'loop.lock');
    const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], {
      detached: true,
      stdio: 'ignore',
    });
    child.unref();
    const pid = child.pid;
    expect(typeof pid).toBe('number');

    await fs.writeFile(lockFile, JSON.stringify({ pid, startedAt: new Date().toISOString() }), 'utf8');
    const result = await stopLoopFromLock(lockFile);
    expect(result.reason).toBe('stopped');
    expect(result.stopped).toBe(true);

    await expect(fs.access(lockFile)).rejects.toThrow();
  });

  test('stopLoopFromLock cleans stale lock', async () => {
    const lockFile = path.join(tempDir, 'loop.lock');
    await fs.writeFile(lockFile, JSON.stringify({ pid: 999999, startedAt: new Date().toISOString() }), 'utf8');
    const result = await stopLoopFromLock(lockFile);
    expect(result.reason).toBe('stale_lock_cleaned');
    expect(result.stopped).toBe(false);
    await expect(fs.access(lockFile)).rejects.toThrow();
  });
});
