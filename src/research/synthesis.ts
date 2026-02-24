import type { ResearchResult, ResearchTask, SourceLink } from '../types.ts';

export function synthesizeResult(
  mode: ResearchResult['mode'],
  task: ResearchTask,
  sources: SourceLink[],
  warning?: string,
): Pick<ResearchResult, 'summary' | 'insights' | 'citations' | 'confidence' | 'confidenceReasons'> {
  const insights = buildInsights(task.query, sources);
  const citations = sources.map((source, index) => `[${index + 1}] ${source.title} - ${source.url}`);
  const confidence = computeConfidence(sources);

  const confidenceReasons: string[] = [];
  confidenceReasons.push(`${sources.length} source(s) captured`);
  confidenceReasons.push(`${new Set(sources.map((source) => source.domain)).size} unique domain(s)`);
  confidenceReasons.push(
    sources.some((source) => (source.content?.length ?? 0) > 1200)
      ? 'At least one source has deep content'
      : 'Sources are shallow or snippet-only',
  );

  const summary =
    insights.length > 0
      ? `Synthesized ${insights.length} evidence-backed insight(s) for "${task.query}" from ${sources.length} source(s).`
      : `Captured ${sources.length} source(s) for "${task.query}" but synthesis is limited.`;

  return {
    summary: warning ? `${summary} Warning: ${warning}` : summary,
    insights,
    citations,
    confidence,
    confidenceReasons,
  };
}

function buildInsights(query: string, sources: SourceLink[]): string[] {
  const insights: string[] = [];
  for (let i = 0; i < sources.length; i += 1) {
    const source = sources[i];
    const text = source.content || source.snippet || '';
    if (!text) {
      continue;
    }

    const sentence = firstUsefulSentence(text);
    if (!sentence) {
      continue;
    }

    insights.push(`${sentence} [${i + 1}]`);
    if (insights.length >= 4) {
      break;
    }
  }

  if (insights.length === 0 && sources.length > 0) {
    insights.push(`Initial results for "${query}" are available, but source text extraction was limited.`);
  }
  return insights;
}

function firstUsefulSentence(text: string): string {
  const candidates = text
    .split(/[.!?]\s+/)
    .map((item) => item.trim())
    .filter((item) => item.length >= 40 && item.length <= 220);

  if (candidates.length === 0) {
    return '';
  }

  return candidates[0];
}

function computeConfidence(sources: SourceLink[]): number {
  if (sources.length === 0) {
    return 0.2;
  }

  const avgQuality = sources.reduce((sum, source) => sum + source.qualityScore, 0) / sources.length;
  const diversity = Math.min(new Set(sources.map((source) => source.domain)).size / 3, 1) * 0.2;
  const contentDepth =
    sources.filter((source) => (source.content?.length ?? 0) > 900).length / Math.max(sources.length, 1);
  const score = Math.min(1, avgQuality * 0.6 + diversity + contentDepth * 0.2);
  return Number(score.toFixed(2));
}
