import path from 'node:path';
import type { SignalForgeConfig } from './types.ts';

export function loadConfig(argv = process.argv.slice(2), env = process.env): SignalForgeConfig {
  const command = argv[0] ?? 'run';
  const commandArgs = argv.slice(1).filter((arg) => !arg.startsWith('--'));
  const flags = new Set(argv.filter((arg) => arg.startsWith('--')));

  const vaultDir = path.resolve(env.VAULT_DIR ?? path.join(process.cwd(), 'vault'));
  const findingsDir = path.resolve(env.FINDINGS_DIR ?? path.join(vaultDir, 'Inbox', 'Findings'));
  const stateFile = path.resolve(env.STATE_FILE ?? path.join(vaultDir, '.signalforge', 'state.json'));
  const maxTasks = readPositiveInt(env.MAX_TASKS, 5);
  const maxSourcesPerTask = readPositiveInt(env.MAX_SOURCES_PER_TASK, 3);
  const maxRetries = readPositiveInt(env.MAX_RETRIES, 4);
  const retryBaseMinutes = readPositiveInt(env.RETRY_BASE_MINUTES, 5);
  const loopIntervalMinutes = readPositiveInt(readFlagValue(argv, '--interval-minutes') ?? env.LOOP_INTERVAL_MINUTES, 60);
  const loopMaxCycles = readOptionalPositiveInt(readFlagValue(argv, '--max-cycles') ?? env.LOOP_MAX_CYCLES);
  const since = readSinceArg(argv);

  return {
    command,
    commandArgs,
    dryRun: flags.has('--dry-run'),
    json: flags.has('--json'),
    force: flags.has('--force'),
    since,
    vaultDir,
    findingsDir,
    stateFile,
    maxTasks,
    maxSourcesPerTask,
    maxRetries,
    retryBaseMinutes,
    loopIntervalMinutes,
    loopMaxCycles,
    browserbase: {
      apiKey: env.BROWSERBASE_API_KEY,
      projectId: env.BROWSERBASE_PROJECT_ID,
      contextId: env.BROWSERBASE_CONTEXT_ID,
    },
    providers: {
      serpApiKey: env.SERPAPI_API_KEY,
      tavilyApiKey: env.TAVILY_API_KEY,
    },
  };
}

export function assertRunnableConfig(config: SignalForgeConfig): void {
  if (!config.vaultDir) {
    throw new Error('Missing vault directory. Set VAULT_DIR.');
  }

  if (!['run', 'init', 'status', 'rerun', 'replay', 'loop'].includes(config.command)) {
    throw new Error(`Unknown command: ${config.command}`);
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

function readSinceArg(argv: string[]): string | undefined {
  const value = readFlagValue(argv, '--since');
  if (!value) {
    return undefined;
  }

  return value.trim();
}

function readFlagValue(argv: string[], flagName: string): string | undefined {
  const prefixed = argv.find((arg) => arg.startsWith(`${flagName}=`));
  if (!prefixed) {
    return undefined;
  }
  return prefixed.slice(`${flagName}=`.length);
}

function readOptionalPositiveInt(rawValue: string | undefined): number | undefined {
  if (!rawValue) {
    return undefined;
  }

  const value = Number(rawValue);
  if (!Number.isInteger(value) || value <= 0) {
    return undefined;
  }
  return value;
}
