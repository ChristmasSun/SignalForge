import fs from 'node:fs/promises';
import path from 'node:path';
import fg from 'fast-glob';

export async function loadVaultMarkdown(vaultDir) {
  const patterns = ['**/*.md', '!**/.obsidian/**', '!**/node_modules/**', '!**/Inbox/Findings/**'];
  const files = await fg(patterns, { cwd: vaultDir, absolute: true, dot: false });

  return Promise.all(
    files.map(async (filePath) => ({
      filePath,
      relPath: path.relative(vaultDir, filePath),
      content: await fs.readFile(filePath, 'utf8'),
    })),
  );
}
