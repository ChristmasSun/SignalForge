function stripCdata(value) {
  return value.replace('<![CDATA[', '').replace(']]>', '').trim();
}

function parseBingRss(xml) {
  const items = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;

  for (const itemMatch of xml.matchAll(itemRegex)) {
    const item = itemMatch[1];
    const titleMatch = item.match(/<title>([\s\S]*?)<\/title>/i);
    const linkMatch = item.match(/<link>([\s\S]*?)<\/link>/i);

    if (!titleMatch || !linkMatch) {
      continue;
    }

    const title = stripCdata(titleMatch[1]);
    const url = stripCdata(linkMatch[1]);

    if (!title || !url) {
      continue;
    }

    items.push({ title, url });
  }

  return dedupe(items);
}

function dedupe(items) {
  const seen = new Set();
  const out = [];
  for (const item of items) {
    if (seen.has(item.url)) {
      continue;
    }
    seen.add(item.url);
    out.push(item);
  }
  return out;
}

async function fetchBingRss(query) {
  const url = `https://www.bing.com/search?q=${encodeURIComponent(query)}&format=rss`;
  const response = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    },
  });

  if (!response.ok) {
    throw new Error(`Bing RSS failed (${response.status})`);
  }

  return response.text();
}

export async function researchWithFallback(task, maxSourcesPerTask = 3) {
  try {
    const xml = await fetchBingRss(task.query);
    const links = parseBingRss(xml).slice(0, maxSourcesPerTask);

    return {
      mode: 'fallback',
      summary: links.length
        ? `Collected ${links.length} result link(s) using Bing RSS fallback research.`
        : 'Could not collect search results in fallback mode.',
      sources: links,
      artifacts: {
        sessionId: null,
        liveViewUrl: null,
        replayHint: null,
        screenshots: [],
      },
    };
  } catch {
    return {
      mode: 'fallback',
      summary: 'Could not collect search results in fallback mode.',
      sources: [],
      artifacts: {
        sessionId: null,
        liveViewUrl: null,
        replayHint: null,
        screenshots: [],
      },
    };
  }
}
