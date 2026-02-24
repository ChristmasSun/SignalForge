import Cerebras from '@cerebras/cerebras_cloud_sdk';
import type { ResearchResult, ResearchTask, SignalForgeConfig, SourceLink } from '../types.ts';

interface LlmSynthesisOutput {
  summary: string;
  insights: string[];
  openQuestions: string[];
  confidence: number;
  confidenceReasons: string[];
}

export async function synthesizeWithLlm(
  task: ResearchTask,
  sources: SourceLink[],
  mode: ResearchResult['mode'],
  config: SignalForgeConfig,
  warning?: string,
): Promise<LlmSynthesisOutput | null> {
  if (!config.cerebras.apiKey) {
    return null;
  }

  const sourceContext = buildSourceContext(sources);
  if (!sourceContext) {
    return null;
  }

  try {
    const client = new Cerebras({ apiKey: config.cerebras.apiKey });

    const systemPrompt = `You are a research synthesis assistant. Given a research query and source content, produce a structured JSON synthesis. Be concise, evidence-driven, and cite sources by number.`;

    const userPrompt = `Research query: "${task.query}"
Source note: ${task.sourceFile}
Research mode: ${mode}
${warning ? `Warning: ${warning}\n` : ''}
Sources (${sources.length}):
${sourceContext}

Respond with a JSON object matching this exact schema:
{
  "summary": "2-3 sentence synthesis of the most important findings",
  "insights": ["insight with [N] citation", "..."] (3-5 bullet insights, each citing at least one source),
  "openQuestions": ["question 1", "question 2", "question 3"] (3 follow-up questions worth investigating),
  "confidence": 0.0-1.0 (float, how well-supported the synthesis is by the sources),
  "confidenceReasons": ["reason 1", "reason 2"] (2-3 reasons explaining the confidence score)
}`;

    const response = await client.chat.completions.create({
      model: config.cerebras.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.2,
      max_completion_tokens: 1024,
      response_format: { type: 'json_object' },
    });

    const choices = (response as { choices?: Array<{ message?: { content?: string } }> }).choices;
    const raw = choices?.[0]?.message?.content ?? '';
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as Partial<LlmSynthesisOutput>;
    return validateOutput(parsed);
  } catch {
    return null;
  }
}

function buildSourceContext(sources: SourceLink[]): string {
  if (sources.length === 0) {
    return '';
  }

  return sources
    .map((source, index) => {
      const text = (source.content || source.snippet || '').slice(0, 1500).trim();
      const lines: string[] = [
        `[${index + 1}] ${source.title} (${source.domain})`,
        `URL: ${source.url}`,
      ];
      if (text) {
        lines.push(`Content: ${text}`);
      }
      return lines.join('\n');
    })
    .join('\n\n---\n\n');
}

function validateOutput(raw: Partial<LlmSynthesisOutput>): LlmSynthesisOutput | null {
  if (typeof raw.summary !== 'string' || !raw.summary.trim()) {
    return null;
  }

  const insights = Array.isArray(raw.insights)
    ? raw.insights.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : [];

  const openQuestions = Array.isArray(raw.openQuestions)
    ? raw.openQuestions.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : [];

  const confidence =
    typeof raw.confidence === 'number' && raw.confidence >= 0 && raw.confidence <= 1
      ? Number(raw.confidence.toFixed(2))
      : 0.5;

  const confidenceReasons = Array.isArray(raw.confidenceReasons)
    ? raw.confidenceReasons.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : [`Synthesized from ${insights.length} evidence point(s)`];

  return {
    summary: raw.summary.trim(),
    insights: insights.length > 0 ? insights : ['No specific insights extracted from sources.'],
    openQuestions,
    confidence,
    confidenceReasons,
  };
}
