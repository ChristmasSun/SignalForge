import { researchWithBrowserbase } from './browserbaseResearcher.js';
import { researchWithFallback } from './fallbackResearcher.js';

export async function runResearch(task, config, outputDir) {
  const canUseBrowserbase = Boolean(config.browserbase.apiKey && config.browserbase.projectId);

  if (canUseBrowserbase) {
    try {
      return await researchWithBrowserbase(task, config, outputDir);
    } catch (error) {
      return {
        ...(await researchWithFallback(task, config.maxSourcesPerTask)),
        warning: `Browserbase research failed, fell back to HTTP: ${error.message}`,
      };
    }
  }

  return researchWithFallback(task, config.maxSourcesPerTask);
}
