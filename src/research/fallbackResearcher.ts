import type { ResearchTask, SignalForgeConfig, SourceLink } from '../types.ts';
import { searchWithProviders } from './searchProviders.ts';

export async function collectSourcesWithFallback(
  task: ResearchTask,
  config: SignalForgeConfig,
): Promise<SourceLink[]> {
  const sources = await searchWithProviders(task, config);
  return sources.slice(0, Math.max(config.maxSourcesPerTask * 2, config.maxSourcesPerTask));
}
