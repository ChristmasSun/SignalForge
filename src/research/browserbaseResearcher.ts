import fs from 'node:fs/promises';
import path from 'node:path';
import Browserbase from '@browserbasehq/sdk';
import { chromium } from 'playwright-core';
import type { ResearchTask, SignalForgeConfig, SourceLink } from '../types.ts';
import { normalizeSource } from './sourceUtils.ts';

export async function collectSourcesWithBrowserbase(
  task: ResearchTask,
  config: SignalForgeConfig,
  outputDir: string,
): Promise<{ sources: SourceLink[]; artifacts: { sessionId: string; liveViewUrl: string | null; replayHint: string; screenshots: string[] } }> {
  if (!config.browserbase.apiKey || !config.browserbase.projectId) {
    throw new Error('Missing Browserbase credentials.');
  }

  const client = new Browserbase({ apiKey: config.browserbase.apiKey });
  const createParams = {
    projectId: config.browserbase.projectId,
    ...(config.browserbase.contextId ? { contextId: config.browserbase.contextId } : {}),
  };
  const session = await client.sessions.create(createParams);

  const live = await client.sessions.debug(session.id);
  const browser = await chromium.connectOverCDP(session.connectUrl);

  const page = await browser.newPage();
  const queryUrl = `https://duckduckgo.com/?q=${encodeURIComponent(task.query)}`;
  await page.goto(queryUrl, { waitUntil: 'domcontentloaded', timeout: 45_000 });
  await page.waitForTimeout(2000);

  const sources = await page.evaluate((limit) => {
    const anchors = Array.from(document.querySelectorAll<HTMLAnchorElement>('a[data-testid="result-title-a"]'));
    return anchors.slice(0, limit).map((el) => ({
      title: (el.textContent ?? '').trim(),
      url: el.href,
    }));
  }, config.maxSourcesPerTask);

  const normalizedSources: SourceLink[] = sources
    .map((item) => normalizeSource({ title: item.title, url: item.url }))
    .filter((item): item is SourceLink => item !== null);

  const shotDir = path.join(outputDir, 'assets');
  await fs.mkdir(shotDir, { recursive: true });
  const screenshotPath = path.join(shotDir, `${slug(task.query)}-search.png`);
  await page.screenshot({ path: screenshotPath, fullPage: true });

  await page.close();
  await browser.close();

  return {
    sources: normalizedSources,
    artifacts: {
      sessionId: session.id,
      liveViewUrl: live.debuggerFullscreenUrl ?? null,
      replayHint: `Recording available via Browserbase session ${session.id}`,
      screenshots: [screenshotPath],
    },
  };
}

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}
