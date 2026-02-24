import fs from 'node:fs/promises';
import path from 'node:path';
import { buildFindingMarkdown } from './templates/findingTemplate.ts';
import type { ResearchResult, ResearchTask, SignalForgeConfig } from './types.ts';

export async function writeFinding(
  config: SignalForgeConfig,
  task: ResearchTask,
  result: ResearchResult,
): Promise<string> {
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
    suggestedMove: suggestedMove(task, result),
    openQuestions: result.openQuestions.length > 0 ? result.openQuestions : buildOpenQuestions(task),
    notePath: task.sourceFile,
    tags: deriveTags(task),
    project: deriveProject(task),
  });

  await fs.writeFile(outputPath, markdown, 'utf8');
  await insertBacklink(config.vaultDir, task.sourceFile, outputPath);
  return outputPath;
}

function suggestedMove(task: ResearchTask, result: ResearchResult): string {
  if (result.sources.length === 0) {
    return `Re-run investigation for "${task.query}" with a refined prompt in your note using #investigate.`;
  }
  return `Review the top source, add one concrete next action under #execute for "${task.query}", then run SignalForge again.`;
}

function buildOpenQuestions(task: ResearchTask): string[] {
  return [
    `What is the strongest practical use-case of "${task.query}" for your current codeflow?`,
    'Which cited source should you validate directly first?',
    'What should be tested in the next 7 days?',
  ];
}

function deriveTags(task: ResearchTask): string[] {
  const queryWords = task.query
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 2)
    .slice(0, 3);
  return ['signalforge', 'research', ...queryWords];
}

function deriveProject(task: ResearchTask): string {
  const firstFolder = task.sourceFile.split('/')[0]?.trim();
  if (!firstFolder || firstFolder.endsWith('.md')) {
    return 'general';
  }
  return firstFolder.toLowerCase().replace(/[^a-z0-9_-]/g, '-');
}

async function insertBacklink(vaultDir: string, sourceFile: string, outputPath: string): Promise<void> {
  const notePath = path.join(vaultDir, sourceFile);
  const relativeFindingPath = path.relative(vaultDir, outputPath).replace(/\\/g, '/');
  const linkLine = `- ${new Date().toISOString().slice(0, 10)}: [[${relativeFindingPath.replace(/\.md$/i, '')}]]`;

  let content = '';
  try {
    content = await fs.readFile(notePath, 'utf8');
  } catch {
    return;
  }

  if (content.includes(linkLine)) {
    return;
  }

  if (content.includes('## SignalForge Findings')) {
    const updated = `${content.trimEnd()}\n${linkLine}\n`;
    await fs.writeFile(notePath, updated, 'utf8');
    return;
  }

  const updated = `${content.trimEnd()}\n\n## SignalForge Findings\n${linkLine}\n`;
  await fs.writeFile(notePath, updated, 'utf8');
}
