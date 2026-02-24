import path from 'node:path';
import type { SignalForgeConfig } from './types.ts';

export function loadConfig(argv = process.argv.slice(2), env = process.env): SignalForgeConfig {
  const command = argv[0] ?? 'run';
  const flags = new Set(argv.slice(1));

  const vaultDir = path.resolve(env.VAULT_DIR ?? path.join(process.cwd(), 'vault'));
  const findingsDir = path.resolve(env.FINDINGS_DIR ?? path.join(vaultDir, 'Inbox', 'Findings'));
  const maxTasks = readPositiveInt(env.MAX_TASKS, 5);
  const maxSourcesPerTask = readPositiveInt(env.MAX_SOURCES_PER_TASK, 3);

  return {
    command,
    dryRun: flags.has('--dry-run'),
    vaultDir,
    findingsDir,
    maxTasks,
    maxSourcesPerTask,
    browserbase: {
      apiKey: env.BROWSERBASE_API_KEY,
      projectId: env.BROWSERBASE_PROJECT_ID,
      contextId: env.BROWSERBASE_CONTEXT_ID,
    },
  };
}

export function assertRunnableConfig(config: SignalForgeConfig): void {
  if (!config.vaultDir) {
    throw new Error('Missing vault directory. Set VAULT_DIR.');
  }
}

function readPositiveInt(rawValue: string | undefined, fallback: number): number {
  if (!rawValue) {
    return fallback;
  }

  const value = Number(rawValue);
  if (!Number.isInteger(value) || value <= 0) {
    return fallback;
  }

  return value;
}
