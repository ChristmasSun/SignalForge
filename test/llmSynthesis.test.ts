import { describe, expect, test } from 'bun:test';
import { synthesizeWithLlm } from '../src/research/llmSynthesis.ts';
import type { SignalForgeConfig, ResearchTask, SourceLink } from '../src/types.ts';

const baseConfig: SignalForgeConfig = {
  command: 'run',
  commandArgs: [],
  dryRun: false,
  json: false,
  daemon: false,
  open: false,
  force: false,
  vaultDir: '/tmp/vault',
  findingsDir: '/tmp/vault/Inbox/Findings',
  stateFile: '/tmp/vault/.signalforge/state.json',
  loopLockFile: '/tmp/vault/.signalforge/loop.lock',
  lockStaleMinutes: 180,
  maxTasks: 5,
  maxSourcesPerTask: 3,
  maxRetries: 4,
  retryBaseMinutes: 5,
  rateLimitMs: 0,
  loopIntervalMinutes: 60,
  browserbase: {},
  providers: {},
  cerebras: {
    apiKey: process.env.CEREBRAS_API_KEY,
    model: 'gpt-oss-120b',
  },
};

const task: ResearchTask = {
  query: 'vector database comparison',
  sourceFile: 'Ideas.md',
  reason: 'explicit_tag',
  sourceSnippet: '#investigate vector database comparison',
};

const sources: SourceLink[] = [
  {
    title: 'Pinecone vs Weaviate',
    url: 'https://example.com/pinecone-vs-weaviate',
    domain: 'example.com',
    qualityScore: 0.8,
    content:
      'Pinecone is a managed vector database optimized for production workloads. Weaviate is an open-source vector search engine with a GraphQL API. Both support approximate nearest neighbor search at scale. Pinecone charges per index and query volume while Weaviate can be self-hosted for free.',
  },
  {
    title: 'Qdrant Overview',
    url: 'https://qdrant.tech/overview',
    domain: 'qdrant.tech',
    qualityScore: 0.75,
    content:
      'Qdrant is a high-performance vector similarity search engine written in Rust. It supports filtering, payload indexing, and on-disk storage. Qdrant can be deployed on-premises or used via Qdrant Cloud.',
  },
];

describe('llmSynthesis', () => {
  test('returns null when no Cerebras API key is configured', async () => {
    const configWithoutKey = { ...baseConfig, cerebras: { model: 'gpt-oss-120b' } };
    const result = await synthesizeWithLlm(task, sources, 'fallback', configWithoutKey);
    expect(result).toBeNull();
  });

  test('returns null when sources are empty', async () => {
    const result = await synthesizeWithLlm(task, [], 'fallback', baseConfig);
    expect(result).toBeNull();
  });

  test('returns structured synthesis from Cerebras with real API key', async () => {
    if (!process.env.CEREBRAS_API_KEY) {
      console.log('Skipping live API test: CEREBRAS_API_KEY not set');
      return;
    }
    const result = await synthesizeWithLlm(task, sources, 'fallback', baseConfig);
    expect(result).not.toBeNull();
    expect(typeof result!.summary).toBe('string');
    expect(result!.summary.length).toBeGreaterThan(20);
    expect(Array.isArray(result!.insights)).toBe(true);
    expect(result!.insights.length).toBeGreaterThan(0);
    expect(Array.isArray(result!.openQuestions)).toBe(true);
    expect(result!.openQuestions.length).toBeGreaterThan(0);
    expect(result!.confidence).toBeGreaterThanOrEqual(0);
    expect(result!.confidence).toBeLessThanOrEqual(1);
    expect(Array.isArray(result!.confidenceReasons)).toBe(true);
  }, 30_000);
});
