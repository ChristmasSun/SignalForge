export type ResearchTaskReason = 'explicit_tag' | 'heuristic_phrase';

export interface VaultNote {
  filePath: string;
  relPath: string;
  content: string;
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
  dryRun: boolean;
  vaultDir: string;
  findingsDir: string;
  maxTasks: number;
  maxSourcesPerTask: number;
  browserbase: BrowserbaseConfig;
}

export interface SourceLink {
  title: string;
  url: string;
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
  sources: SourceLink[];
  artifacts: ResearchArtifacts;
  warning?: string;
}

export interface FindingTemplateInput {
  date: string;
  task: ResearchTask;
  result: ResearchResult;
  suggestedMove: string;
  openQuestions: string[];
  confidence: number;
  notePath: string;
}
