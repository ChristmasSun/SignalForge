import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { acquireLoopLock } from '../src/lock.ts';

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
});
