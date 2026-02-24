#!/usr/bin/env bun
import { loadConfig, assertRunnableConfig } from './config.ts';
import { createLogger } from './logger.ts';
import { executeCommand } from './runner.ts';
import type { SignalForgeConfig } from './types.ts';

async function main(): Promise<void> {
  const config: SignalForgeConfig = loadConfig();
  assertRunnableConfig(config);
  const logger = createLogger({ json: config.json });
  await executeCommand(config, logger);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[SignalForge] ${message}`);
  process.exit(1);
});
