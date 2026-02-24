import type { ResearchResult, ResearchTask, SignalForgeConfig } from '../types.ts';
import { researchWithBrowserbase } from './browserbaseResearcher.ts';
import { researchWithFallback } from './fallbackResearcher.ts';

export async function runResearch(
  task: ResearchTask,
  config: SignalForgeConfig,
  outputDir: string,
): Promise<ResearchResult> {
  const canUseBrowserbase = Boolean(config.browserbase.apiKey && config.browserbase.projectId);

  if (canUseBrowserbase) {
    try {
      return await researchWithBrowserbase(task, config, outputDir);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown error';
      return {
        ...(await researchWithFallback(task, config.maxSourcesPerTask)),
        warning: `Browserbase research failed, fell back to HTTP: ${message}`,
      };
    }
  }

  return researchWithFallback(task, config.maxSourcesPerTask);
}
