import type { FindingTemplateInput } from '../types.ts';

export function buildFindingMarkdown(input: FindingTemplateInput): string {
  const {
    date,
    task,
    result,
    suggestedMove,
    openQuestions,
    confidence,
    notePath,
  } = input;

  const sources = result.sources.length
    ? result.sources.map((source) => `- [${source.title || source.url}](${source.url})`).join('\n')
    : '- No sources captured';

  const screenshots = result.artifacts.screenshots.length
    ? result.artifacts.screenshots.map((item) => `- ${item}`).join('\n')
    : '- None';

  return `---
type: signalforge_finding
date: ${date}
query: "${escapeQuotes(task.query)}"
source_note: "${escapeQuotes(task.sourceFile)}"
confidence: ${confidence}
mode: ${result.mode}
---

# SignalForge Finding: ${task.query}

## What changed
${result.summary}

## Why it matters
This topic appeared in your notes and has been converted into a research task tied to your workflow.

## Suggested move
${suggestedMove}

## Evidence links
${sources}

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
