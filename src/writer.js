import fs from 'node:fs/promises';
import path from 'node:path';
import { buildFindingMarkdown } from './templates/findingTemplate.js';

export async function writeFinding(config, task, result) {
  const date = new Date().toISOString().slice(0, 10);
  const slug = task.query
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);

  const outputPath = path.join(config.findingsDir, `${date} - ${slug}.md`);
  await fs.mkdir(path.dirname(outputPath), { recursive: true });

  const markdown = buildFindingMarkdown({
    date,
    task,
    result,
    confidence: scoreConfidence(result),
    suggestedMove: suggestedMove(task, result),
    openQuestions: buildOpenQuestions(task),
    notePath: task.sourceFile,
  });

  await fs.writeFile(outputPath, markdown, 'utf8');
  return outputPath;
}

function scoreConfidence(result) {
  if (result.mode === 'browserbase' && result.sources.length >= 3) {
    return 0.8;
  }
  if (result.sources.length >= 2) {
    return 0.65;
  }
  return 0.45;
}

function suggestedMove(task, result) {
  if (result.sources.length === 0) {
    return `Re-run investigation for "${task.query}" with a refined prompt in your note using #investigate.`;
  }
  return `Review the top source, add one concrete next action under #execute for "${task.query}", then run SignalForge again.`;
}

function buildOpenQuestions(task) {
  return [
    `What is the strongest practical use-case of "${task.query}" for your current codeflow?`,
    'Which source is most credible and current?',
    'What should be tested in the next 7 days?',
  ];
}
