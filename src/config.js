import path from 'node:path';

export function loadConfig(argv = process.argv.slice(2), env = process.env) {
  const command = argv[0] ?? 'run';
  const flags = new Set(argv.slice(1));

  const vaultDir = path.resolve(env.VAULT_DIR ?? path.join(process.cwd(), 'vault'));
  const findingsDir = path.resolve(env.FINDINGS_DIR ?? path.join(vaultDir, 'Inbox', 'Findings'));
  const maxTasks = Number(env.MAX_TASKS ?? 5);
  const maxSourcesPerTask = Number(env.MAX_SOURCES_PER_TASK ?? 3);

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

export function assertRunnableConfig(config) {
  if (!config.vaultDir) {
    throw new Error('Missing vault directory. Set VAULT_DIR.');
  }
}
