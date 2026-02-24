#!/usr/bin/env bun
import { loadConfig, assertRunnableConfig } from './config.ts';
import { loadVaultMarkdown } from './vault.ts';
import { extractResearchTasks } from './intents.ts';
import { runResearch } from './research/index.ts';
import { writeFinding } from './writer.ts';
import type { SignalForgeConfig } from './types.ts';

async function main(): Promise<void> {
  const config: SignalForgeConfig = loadConfig();
  assertRunnableConfig(config);

  if (config.command !== 'run') {
    throw new Error(`Unknown command: ${config.command}`);
  }

  const notes = await loadVaultMarkdown(config.vaultDir);
  const tasks = extractResearchTasks(notes, config.maxTasks);

  if (tasks.length === 0) {
    console.log('No research intents found. Add #investigate in your notes.');
    return;
  }

  console.log(`Found ${tasks.length} research task(s).`);

  for (const task of tasks) {
    console.log(`\n[SignalForge] Investigating: ${task.query}`);
    console.log(`Source: ${task.sourceFile}`);

    if (config.dryRun) {
      console.log('Dry run enabled, skipping research execution.');
      continue;
    }

    const result = await runResearch(task, config, config.findingsDir);
    const outputPath = await writeFinding(config, task, result);

    if (result.warning) {
      console.log(`Warning: ${result.warning}`);
    }

    console.log(`Wrote finding: ${outputPath}`);
    if (result.artifacts.liveViewUrl) {
      console.log(`Live View: ${result.artifacts.liveViewUrl}`);
    }
    if (result.artifacts.sessionId) {
      console.log(`Session: ${result.artifacts.sessionId}`);
    }
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[SignalForge] ${message}`);
  process.exit(1);
});
