import type { ResearchTask, VaultNote } from './types.ts';

const EXPLICIT_INVESTIGATE = /#investigate\b(?::|\s+)?([^\n#]*)/gi;

const HINT_PATTERNS = [
  /\bread about\s+(.+)/i,
  /\blook into\s+(.+)/i,
  /\bresearch\s+(.+)/i,
  /\bwondering what\s+(.+)/i,
  /\b(?:something|smth) about\s+(.+)/i,
  // Additional patterns
  /\bexplore\s+(.+)/i,
  /\bdig into\s+(.+)/i,
  /\bcheck out\s+(.+)/i,
  /\blearn (?:more )?about\s+(.+)/i,
  /\bfigure out\s+(.+)/i,
  /\bunderstand\s+(.+)/i,
  /\bhow does\s+(.+)\s+work/i,
  /\bwhat is\s+(.+)/i,
  /\bwhat are\s+(.+)/i,
  /\bwhy (?:is|are|does|do)\s+(.+)/i,
  /\bneed to (?:know|understand|learn)\s+(.+)/i,
  /\bcurious about\s+(.+)/i,
  /\binvestigate\s+(.+)/i,
  /\bfollow up on\s+(.+)/i,
  /\bkeep an eye on\s+(.+)/i,
];

const BAD_STARTS = new Set(['that', 'this', 'it', 'as', 'well', 'maybe', 'and', 'but', 'so', 'the', 'a', 'an']);

export function extractResearchTasks(notes: VaultNote[], maxTasks = 5): ResearchTask[] {
  const tasks: ResearchTask[] = [];
  const seen = new Set<string>();

  for (const note of notes) {
    collectExplicit(note, tasks, seen);
    collectHeuristic(note, tasks, seen);
    if (tasks.length >= maxTasks) {
      break;
    }
  }

  return tasks.slice(0, maxTasks);
}

function collectExplicit(note: VaultNote, tasks: ResearchTask[], seen: Set<string>): void {
  for (const match of note.content.matchAll(EXPLICIT_INVESTIGATE)) {
    const raw = (match[1] ?? '').trim();
    if (!raw) {
      continue;
    }

    const query = normalizeQuery(raw);
    if (!isReasonableQuery(query)) {
      continue;
    }

    pushTask(tasks, seen, {
      query,
      sourceFile: note.relPath,
      reason: 'explicit_tag',
      sourceSnippet: match[0].trim(),
    });
  }
}

function collectHeuristic(note: VaultNote, tasks: ResearchTask[], seen: Set<string>): void {
  const lines = note.content
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  for (const line of lines) {
    if (line.includes('#investigate')) {
      continue;
    }

    for (const pattern of HINT_PATTERNS) {
      const match = line.match(pattern);
      if (!match) {
        continue;
      }

      const query = normalizeQuery(match[1]);
      if (!isReasonableQuery(query)) {
        continue;
      }

      pushTask(tasks, seen, {
        query,
        sourceFile: note.relPath,
        reason: 'heuristic_phrase',
        sourceSnippet: line,
      });

      break;
    }
  }
}

function pushTask(tasks: ResearchTask[], seen: Set<string>, task: ResearchTask): void {
  const key = task.query.toLowerCase();
  if (seen.has(key)) {
    return;
  }

  seen.add(key);
  tasks.push(task);
}

function normalizeQuery(text: string): string {
  let value = text
    .replace(/^[:\-\s]+/, '')
    .replace(/["'`]+/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  value = value
    .replace(/\b(as well|maybe|for now|at some point)\b.*$/i, '')
    .replace(/\b(could help|might help|is|are)\b.*$/i, '')
    .trim();

  value = value.split(',')[0].trim();
  value = value.replace(/[.?!;:]+$/, '').trim();

  return value;
}

function isReasonableQuery(query: string): boolean {
  if (!query || query.length < 3 || query.length > 80) {
    return false;
  }

  const firstWord = query.split(/\s+/)[0]?.toLowerCase();
  if (!firstWord || BAD_STARTS.has(firstWord)) {
    return false;
  }

  return /[a-z0-9]/i.test(query);
}
