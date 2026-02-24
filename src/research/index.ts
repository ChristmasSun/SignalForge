import type { ResearchResult, ResearchTask, SignalForgeConfig } from '../types.ts';
import { collectSourcesWithBrowserbase } from './browserbaseResearcher.ts';
import { enrichSourcesWithContent } from './contentFetcher.ts';
import { collectSourcesWithFallback } from './fallbackResearcher.ts';
import { synthesizeWithLlm } from './llmSynthesis.ts';
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
    replayUrl: null,
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

  const citations = selected.map((source, index) => `[${index + 1}] ${source.title} - ${source.url}`);

  // Attempt LLM synthesis via Cerebras; fall back to heuristic if unavailable or fails
  const llmResult = await synthesizeWithLlm(task, selected, mode, config, warning);

  let summary: string;
  let insights: string[];
  let confidence: number;
  let confidenceReasons: string[];
  let openQuestions: string[];
  let llmSynthesized: boolean;

  if (llmResult) {
    summary = llmResult.summary;
    insights = llmResult.insights;
    confidence = llmResult.confidence;
    confidenceReasons = llmResult.confidenceReasons;
    openQuestions = llmResult.openQuestions;
    llmSynthesized = true;
    if (warning) {
      summary = `${summary} Warning: ${warning}`;
    }
  } else {
    const heuristic = synthesizeResult(mode, task, selected, warning);
    summary = heuristic.summary;
    insights = heuristic.insights;
    confidence = heuristic.confidence;
    confidenceReasons = heuristic.confidenceReasons;
    openQuestions = [];
    llmSynthesized = false;
  }

  return {
    mode,
    summary,
    insights,
    citations,
    sources: selected,
    artifacts,
    confidence,
    confidenceReasons,
    openQuestions,
    llmSynthesized,
    warning,
  };
}
