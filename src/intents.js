const EXPLICIT_INVESTIGATE = /#investigate\b(?::|\s+)?([^\n#]*)/gi;

const HINT_PATTERNS = [
  /\bread about\s+(.+)/i,
  /\blook into\s+(.+)/i,
  /\bresearch\s+(.+)/i,
  /\bwondering what\s+(.+)/i,
  /\b(?:something|smth) about\s+(.+)/i,
];

const BAD_STARTS = new Set(['that', 'this', 'it', 'as', 'well', 'maybe', 'and']);

export function extractResearchTasks(notes, maxTasks = 5) {
  const tasks = [];
  const seen = new Set();

  for (const note of notes) {
    collectExplicit(note, tasks, seen);
    collectHeuristic(note, tasks, seen);
    if (tasks.length >= maxTasks) {
      break;
    }
  }

  return tasks.slice(0, maxTasks);
}

function collectExplicit(note, tasks, seen) {
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

function collectHeuristic(note, tasks, seen) {
  const lines = note.content
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  for (const line of lines) {
    if (line.includes("#investigate")) {
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

function pushTask(tasks, seen, task) {
  const key = task.query.toLowerCase();
  if (seen.has(key)) {
    return;
  }
  seen.add(key);
  tasks.push(task);
}

function normalizeQuery(text) {
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

function isReasonableQuery(query) {
  if (!query || query.length < 3 || query.length > 80) {
    return false;
  }

  const firstWord = query.split(/\s+/)[0]?.toLowerCase();
  if (!firstWord || BAD_STARTS.has(firstWord)) {
    return false;
  }

  return /[a-z0-9]/i.test(query);
}
