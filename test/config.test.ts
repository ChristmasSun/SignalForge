import { describe, expect, test } from 'bun:test';
import { loadConfig } from '../src/config.ts';

describe('loadConfig', () => {
  test('uses defaults for invalid numeric env values', () => {
    const config = loadConfig(['run'], {
      MAX_TASKS: '-1',
      MAX_SOURCES_PER_TASK: 'abc',
      MAX_RETRIES: '0',
      RETRY_BASE_MINUTES: '-5',
      LOOP_INTERVAL_MINUTES: '0',
      LOOP_MAX_CYCLES: '-1',
    } as NodeJS.ProcessEnv);

    expect(config.maxTasks).toBe(5);
    expect(config.maxSourcesPerTask).toBe(3);
    expect(config.maxRetries).toBe(4);
    expect(config.retryBaseMinutes).toBe(5);
    expect(config.loopIntervalMinutes).toBe(60);
    expect(config.loopMaxCycles).toBeUndefined();
  });

  test('parses flags and since arg', () => {
    const config = loadConfig(['run', '--json', '--force', '--since=7d'], {} as NodeJS.ProcessEnv);
    expect(config.json).toBe(true);
    expect(config.force).toBe(true);
    expect(config.since).toBe('7d');
  });
});
