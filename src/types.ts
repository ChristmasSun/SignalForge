export type ResearchTaskReason = 'explicit_tag' | 'heuristic_phrase';

export interface VaultNote {
  filePath: string;
  relPath: string;
  content: string;
  mtimeMs: number;
}

export interface ResearchTask {
  query: string;
  sourceFile: string;
  reason: ResearchTaskReason;
  sourceSnippet: string;
}

export interface BrowserbaseConfig {
  apiKey?: string;
  projectId?: string;
  contextId?: string;
}

export interface SignalForgeConfig {
  command: string;
  commandArgs: string[];
  dryRun: boolean;
  json: boolean;
  force: boolean;
  since?: string;
  vaultDir: string;
  findingsDir: string;
  stateFile: string;
  maxTasks: number;
  maxSourcesPerTask: number;
  maxRetries: number;
  retryBaseMinutes: number;
  browserbase: BrowserbaseConfig;
  providers: {
    serpApiKey?: string;
    tavilyApiKey?: string;
  };
}

export interface SourceLink {
  title: string;
  url: string;
  snippet?: string;
  domain: string;
  fetchedAt?: string;
  content?: string;
  qualityScore: number;
}

export interface ResearchArtifacts {
  sessionId: string | null;
  liveViewUrl: string | null;
  replayHint: string | null;
  screenshots: string[];
}

export type ResearchMode = 'browserbase' | 'fallback';

export interface ResearchResult {
  mode: ResearchMode;
  summary: string;
  insights: string[];
  citations: string[];
  sources: SourceLink[];
  artifacts: ResearchArtifacts;
  confidence: number;
  confidenceReasons: string[];
  warning?: string;
}

export interface FindingTemplateInput {
  date: string;
  task: ResearchTask;
  result: ResearchResult;
  suggestedMove: string;
  openQuestions: string[];
  notePath: string;
  tags: string[];
  project: string;
}

export type TaskStatus = 'pending' | 'in_progress' | 'done' | 'failed';

export interface TaskStateRecord {
  key: string;
  query: string;
  sourceFile: string;
  status: TaskStatus;
  attempts: number;
  lastRunAt?: string;
  lastSuccessAt?: string;
  lastFailureAt?: string;
  nextRetryAt?: string;
  lastNoteMtimeMs?: number;
  findingPath?: string;
  lastError?: string;
}

export interface StateFile {
  version: number;
  updatedAt: string;
  tasks: Record<string, TaskStateRecord>;
}

export interface RunStats {
  startedAt: string;
  endedAt?: string;
  durationMs?: number;
  total: number;
  processed: number;
  succeeded: number;
  failed: number;
  skipped: number;
}
