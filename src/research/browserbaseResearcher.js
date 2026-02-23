import fs from 'node:fs/promises';
import path from 'node:path';
import Browserbase from '@browserbasehq/sdk';
import { chromium } from 'playwright-core';

export async function researchWithBrowserbase(task, config, outputDir) {
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
    const anchors = Array.from(document.querySelectorAll('a[data-testid="result-title-a"]'));
    return anchors.slice(0, limit).map((el) => ({
      title: (el.textContent || '').trim(),
      url: el.href,
    }));
  }, config.maxSourcesPerTask);

  const shotDir = path.join(outputDir, 'assets');
  await fs.mkdir(shotDir, { recursive: true });
  const screenshotPath = path.join(shotDir, `${slug(task.query)}-search.png`);
  await page.screenshot({ path: screenshotPath, fullPage: true });

  await page.close();
  await browser.close();

  return {
    mode: 'browserbase',
    summary: `Collected ${sources.length} result link(s) in a Browserbase session.`,
    sources,
    artifacts: {
      sessionId: session.id,
      liveViewUrl: live.debuggerFullscreenUrl,
      replayHint: `Recording available via Browserbase session ${session.id}`,
      screenshots: [screenshotPath],
    },
  };
}

function slug(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}
