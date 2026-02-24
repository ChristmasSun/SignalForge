import type { ResearchResult, ResearchTask, SignalForgeConfig } from '../types.ts';
import { collectSourcesWithBrowserbase } from './browserbaseResearcher.ts';
import { enrichSourcesWithContent } from './contentFetcher.ts';
import { collectSourcesWithFallback } from './fallbackResearcher.ts';
import { dedupeByDomain, rescoreWithContent } from './sourceUtils.ts';
import { synthesizeResult } from './synthesis.ts';

export async function runResearch(
  task: ResearchTask,
  config: SignalForgeConfig,
  outputDir: string,
): Promise<ResearchResult> {
  let warning: string | undefined;
  let mode: ResearchResult['mode'] = 'fallback';
  let artifacts: ResearchResult['artifacts'] = {
    sessionId: null,
    liveViewUrl: null,
    replayHint: null,
    screenshots: [],
  };

  const canUseBrowserbase = Boolean(config.browserbase.apiKey && config.browserbase.projectId);
  let candidateSources = await collectSourcesWithFallback(task, config);

  if (canUseBrowserbase) {
    try {
      const browserbase = await collectSourcesWithBrowserbase(task, config, outputDir);
      if (browserbase.sources.length > 0) {
        candidateSources = browserbase.sources;
      }
      mode = 'browserbase';
      artifacts = browserbase.artifacts;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown error';
      warning = `Browserbase research failed, fell back to HTTP: ${message}`;
    }
  }

  const unique = dedupeByDomain(candidateSources, config.maxSourcesPerTask);
  const enriched = await enrichSourcesWithContent(unique);
  const scored = enriched.map(rescoreWithContent).sort((a, b) => b.qualityScore - a.qualityScore);
  const selected = scored.slice(0, config.maxSourcesPerTask);
  const synthesis = synthesizeResult(mode, task, selected, warning);

  return {
    mode,
    summary: synthesis.summary,
    insights: synthesis.insights,
    citations: synthesis.citations,
    sources: selected,
    artifacts,
    confidence: synthesis.confidence,
    confidenceReasons: synthesis.confidenceReasons,
    warning,
  };
}
