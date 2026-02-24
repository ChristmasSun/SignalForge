import type { FindingTemplateInput } from '../types.ts';

export function buildFindingMarkdown(input: FindingTemplateInput): string {
  const {
    date,
    task,
    result,
    suggestedMove,
    openQuestions,
    notePath,
    tags,
    project,
  } = input;

  const sources = result.sources.length
    ? result.sources
        .map(
          (source, index) =>
            `- [${index + 1}] [${source.title || source.url}](${source.url}) (domain: ${source.domain}, quality: ${source.qualityScore})`,
        )
        .join('\n')
    : '- No sources captured';

  const screenshots = result.artifacts.screenshots.length
    ? result.artifacts.screenshots.map((item) => `- ${item}`).join('\n')
    : '- None';

  return `---
type: signalforge_finding
date: ${date}
query: "${escapeQuotes(task.query)}"
source_note: "${escapeQuotes(task.sourceFile)}"
project: "${project}"
tags: [${tags.map((tag) => `"${escapeQuotes(tag)}"`).join(', ')}]
confidence: ${result.confidence}
mode: ${result.mode}
---

# SignalForge Finding: ${task.query}

## What changed
${result.summary}

## Key insights
${result.insights.length > 0 ? result.insights.map((item) => `- ${item}`).join('\n') : '- No synthesized insights available'}

## Why it matters
This topic appeared in your notes and has been converted into a research task tied to your workflow.

## Suggested move
${suggestedMove}

## Evidence links
${sources}

## Citation checks
${result.citations.length > 0 ? result.citations.map((item) => `- ${item}`).join('\n') : '- No citation metadata available'}

## Confidence breakdown
${result.confidenceReasons.map((item) => `- ${item}`).join('\n')}

## Artifacts
- Source note: ${notePath}
- Browserbase session: ${result.artifacts.sessionId ?? 'N/A'}
- Live view: ${result.artifacts.liveViewUrl ?? 'N/A'}
- Replay hint: ${result.artifacts.replayHint ?? 'N/A'}
- Screenshots:
${screenshots}

## Open questions
${openQuestions.map((q) => `- ${q}`).join('\n')}
`;
}

function escapeQuotes(value: string): string {
  return value.replace(/"/g, '\\"');
}
