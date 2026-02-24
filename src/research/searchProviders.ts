import type { ResearchTask, SignalForgeConfig, SourceLink } from '../types.ts';
import { normalizeSource } from './sourceUtils.ts';

export async function searchWithProviders(task: ResearchTask, config: SignalForgeConfig): Promise<SourceLink[]> {
  const fromSerpApi = await searchWithSerpApi(task.query, config.providers.serpApiKey);
  if (fromSerpApi.length > 0) {
    return fromSerpApi;
  }

  const fromTavily = await searchWithTavily(task.query, config.providers.tavilyApiKey);
  if (fromTavily.length > 0) {
    return fromTavily;
  }

  return searchWithBingRss(task.query);
}

async function searchWithSerpApi(query: string, apiKey?: string): Promise<SourceLink[]> {
  if (!apiKey) {
    return [];
  }

  try {
    const url = `https://serpapi.com/search.json?engine=google&q=${encodeURIComponent(query)}&num=10&api_key=${apiKey}`;
    const response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!response.ok) {
      return [];
    }

    const data = (await response.json()) as {
      organic_results?: Array<{ title?: string; link?: string; snippet?: string }>;
    };
    return (data.organic_results ?? [])
      .map((item) => normalizeSource({ title: item.title, url: item.link ?? '', snippet: item.snippet }))
      .filter((item): item is SourceLink => item !== null);
  } catch {
    return [];
  }
}

async function searchWithTavily(query: string, apiKey?: string): Promise<SourceLink[]> {
  if (!apiKey) {
    return [];
  }

  try {
    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        max_results: 8,
        include_raw_content: false,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      return [];
    }

    const data = (await response.json()) as {
      results?: Array<{ title?: string; url?: string; content?: string }>;
    };
    return (data.results ?? [])
      .map((item) => normalizeSource({ title: item.title, url: item.url ?? '', snippet: item.content }))
      .filter((item): item is SourceLink => item !== null);
  } catch {
    return [];
  }
}

async function searchWithBingRss(query: string): Promise<SourceLink[]> {
  try {
    const url = `https://www.bing.com/search?q=${encodeURIComponent(query)}&format=rss`;
    const response = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      return [];
    }

    const xml = await response.text();
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    const output: SourceLink[] = [];

    for (const match of xml.matchAll(itemRegex)) {
      const chunk = match[1];
      const titleMatch = chunk.match(/<title>([\s\S]*?)<\/title>/i);
      const linkMatch = chunk.match(/<link>([\s\S]*?)<\/link>/i);
      const descMatch = chunk.match(/<description>([\s\S]*?)<\/description>/i);
      if (!titleMatch || !linkMatch) {
        continue;
      }

      const title = stripCdata(titleMatch[1]);
      const link = stripCdata(linkMatch[1]);
      const description = stripCdata(descMatch?.[1] ?? '');
      const source = normalizeSource({ title, url: link, snippet: description });
      if (source) {
        output.push(source);
      }
    }

    return output;
  } catch {
    return [];
  }
}

function stripCdata(value: string): string {
  return value.replace('<![CDATA[', '').replace(']]>', '').trim();
}
