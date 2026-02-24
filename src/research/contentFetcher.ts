import type { SourceLink } from '../types.ts';

export async function enrichSourcesWithContent(sources: SourceLink[]): Promise<SourceLink[]> {
  const enriched: SourceLink[] = [];

  for (const source of sources) {
    const content = await fetchPageText(source.url);
    enriched.push({
      ...source,
      content,
      fetchedAt: new Date().toISOString(),
    });
  }

  return enriched;
}

async function fetchPageText(url: string): Promise<string> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      },
      signal: AbortSignal.timeout(12_000),
    });

    if (!response.ok) {
      return '';
    }

    const html = await response.text();
    return cleanHtml(html);
  } catch {
    return '';
  }
}

function cleanHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 6000);
}
