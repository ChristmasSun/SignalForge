import fs from 'node:fs/promises';
import path from 'node:path';
import fg from 'fast-glob';
import type { VaultNote } from './types.ts';

export async function loadVaultMarkdown(vaultDir: string, since?: string): Promise<VaultNote[]> {
  const patterns = ['**/*.md', '!**/.obsidian/**', '!**/node_modules/**', '!**/Inbox/Findings/**'];
  const files = await fg(patterns, { cwd: vaultDir, absolute: true, dot: false });
  const sinceMs = parseSinceToEpochMs(since);

  const notes = await Promise.all(
    files.map(async (filePath) => ({
      filePath,
      relPath: path.relative(vaultDir, filePath),
      content: await fs.readFile(filePath, 'utf8'),
      mtimeMs: (await fs.stat(filePath)).mtimeMs,
    })),
  );

  if (!sinceMs) {
    return notes;
  }

  return notes.filter((note) => note.mtimeMs >= sinceMs);
}

function parseSinceToEpochMs(since?: string): number | undefined {
  if (!since) {
    return undefined;
  }

  const trimmed = since.trim();
  const relative = trimmed.match(/^(\d+)([dh])$/i);
  if (relative) {
    const value = Number(relative[1]);
    const unit = relative[2].toLowerCase();
    const durationMs = unit === 'd' ? value * 24 * 60 * 60 * 1000 : value * 60 * 60 * 1000;
    return Date.now() - durationMs;
  }

  const epoch = Date.parse(trimmed);
  if (Number.isNaN(epoch)) {
    return undefined;
  }

  return epoch;
}
