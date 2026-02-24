import type { SourceLink } from '../types.ts';

const TRUSTED_DOMAINS = new Set([
  'github.com',
  'docs.github.com',
  'developer.mozilla.org',
  'wikipedia.org',
  'arxiv.org',
  'openai.com',
  'npmjs.com',
  'bun.sh',
]);

export function normalizeSource(input: { title?: string; url: string; snippet?: string }): SourceLink | null {
  if (!input.url) {
    return null;
  }

  const domain = getDomain(input.url);
  if (!domain) {
    return null;
  }

  return {
    title: input.title?.trim() || input.url,
    url: input.url,
    snippet: input.snippet?.trim(),
    domain,
    qualityScore: baseQualityScore(domain, input.title ?? ''),
  };
}

export function dedupeByDomain(sources: SourceLink[], maxSources: number): SourceLink[] {
  const sorted = [...sources].sort((a, b) => b.qualityScore - a.qualityScore);
  const picked: SourceLink[] = [];
  const seenDomain = new Set<string>();

  for (const source of sorted) {
    if (seenDomain.has(source.domain)) {
      continue;
    }
    picked.push(source);
    seenDomain.add(source.domain);
    if (picked.length >= maxSources) {
      break;
    }
  }

  return picked;
}

export function rescoreWithContent(source: SourceLink): SourceLink {
  const contentLength = source.content?.length ?? 0;
  const lengthScore = Math.min(contentLength / 3000, 1) * 0.4;
  const snippetScore = source.snippet ? 0.1 : 0;
  const trustedScore = isTrustedDomain(source.domain) ? 0.2 : 0;
  const httpsScore = source.url.startsWith('https://') ? 0.1 : 0;
  const total = Math.min(1, source.qualityScore + lengthScore + snippetScore + trustedScore + httpsScore);
  return { ...source, qualityScore: Number(total.toFixed(3)) };
}

function baseQualityScore(domain: string, title: string): number {
  const trusted = isTrustedDomain(domain) ? 0.25 : 0;
  const httpsLike = 0.15;
  const titleScore = Math.min((title.trim().length || 0) / 80, 1) * 0.15;
  return Number((trusted + httpsLike + titleScore).toFixed(3));
}

function isTrustedDomain(domain: string): boolean {
  if (TRUSTED_DOMAINS.has(domain)) {
    return true;
  }
  for (const trusted of TRUSTED_DOMAINS) {
    if (domain.endsWith(`.${trusted}`)) {
      return true;
    }
  }
  return false;
}

function getDomain(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}
