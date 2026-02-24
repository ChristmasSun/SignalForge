# SignalForge

SignalForge converts research intent in your Obsidian vault into structured, evidence-backed findings.

It scans notes, detects investigation prompts, runs web research, synthesizes key insights with citations, writes findings into your inbox, and tracks task state over time.

## Integrations

- Obsidian vault markdown as the source of intents and destination for findings.
- Browserbase for full browser-session research and replay metadata.
- SerpAPI for search-provider fallback (optional).
- Tavily for search-provider fallback (optional).
- Bing RSS as the final no-key fallback search path.

## Why Use SignalForge

- Turn scattered curiosity into actionable research artifacts.
- Keep research output inside your existing vault workflow.
- Avoid duplicate work with stateful incremental processing.
- Run continuously in loop/daemon mode for ongoing intelligence capture.

## Core Capabilities

- Intent extraction from markdown notes:
  - explicit tags: `#investigate ...`
  - natural-language triggers (examples below)
- Multi-source research pipeline:
  - Browserbase session mode when configured
  - fallback provider chain: SerpAPI -> Tavily -> Bing RSS
  - content extraction from source pages
- Evidence quality controls:
  - domain-level dedupe
  - source quality scoring
  - confidence scoring with reasons
  - citation list generation
- Stateful execution:
  - task status tracking (`pending`, `in_progress`, `done`, `failed`)
  - retry/backoff for failed tasks
  - incremental skip for already-processed unchanged notes
- Vault-native outputs:
  - finding markdown files in `Inbox/Findings`
  - backlinks injected into source notes
  - loop cycle summaries for scheduled runs

## Typical Use Cases

- Market and competitor tracking from product notes.
- Technical due diligence from architecture brainstorms.
- Founder/research operating cadence with daily loop runs.
- Team knowledge ops: convert raw questions into reusable findings.

## How It Works

1. Scan vault markdown notes.
2. Extract research tasks from explicit tags and intent phrases.
3. Resolve sources via Browserbase or provider fallbacks.
4. Fetch source content and rank/dedupe evidence.
5. Synthesize insights, citations, and confidence.
6. Write finding markdown and update task state.

## Installation

```bash
bun install
cp .env.example .env
```

## Quick Start

1. Set required env:
```bash
export VAULT_DIR="/absolute/path/to/your/ObsidianVault"
```

2. Initialize workspace metadata:
```bash
bun run init
```

3. Run once:
```bash
bun run run
```

4. Check status:
```bash
bun run status
```

## Intent Detection

SignalForge detects both explicit and natural phrasing.

Explicit pattern:

```md
#investigate best lightweight analytics for a B2B SaaS app
```

Natural-language examples:

- `read about event-driven architecture patterns`
- `look into SOC 2 automation options`
- `research workflow orchestration tools`
- `wondering what retrieval-augmented generation means`
- `something about edge caching strategies`

## Commands

- `bun run init`
  - Initialize findings directory and state file.
- `bun run run`
  - Run one full research pass.
- `bun run dry`
  - Detect tasks only, no research execution.
- `bun run status`
  - Show current task-state summary.
- `bun run rerun "<query>"`
  - Force rerun a specific query.
- `bun run replay "<query-or-session-id>"`
  - Show stored Browserbase replay metadata for a task.
- `bun run replay "<query-or-session-id>" --open`
  - Open replay/live URL automatically when available.
- `bun run loop --interval-minutes=60 --max-cycles=8`
  - Run scheduled in-process loop.
- `bun run loop:daemon --interval-minutes=60`
  - Start loop in detached daemon mode.
- `bun run loop:stop`
  - Stop daemon using lockfile PID.
- `bun run loop:stop --force`
  - Force-stop daemon (SIGKILL fallback path).

## Useful Flags

- `--since=7d` or `--since=2026-01-01`
  - Process only recently modified notes.
- `--json`
  - Structured JSON logs (machine-readable).
- `--force`
  - Bypass incremental skip and rerun tasks.

## Output Artifacts

- Findings:
  - `<VAULT_DIR>/Inbox/Findings/YYYY-MM-DD - <query>.md`
- Loop summaries:
  - `<VAULT_DIR>/Inbox/Findings/Run Summaries/*.md`
- Task state:
  - `<VAULT_DIR>/.signalforge/state.json`
- Loop lock:
  - `<VAULT_DIR>/.signalforge/loop.lock`

## Configuration

Required:

- `VAULT_DIR`

Research providers:

- `BROWSERBASE_API_KEY`
- `BROWSERBASE_PROJECT_ID`
- `BROWSERBASE_CONTEXT_ID` (optional)
- `SERPAPI_API_KEY` (optional)
- `TAVILY_API_KEY` (optional)

Execution tuning:

- `MAX_TASKS` (default `5`)
- `MAX_SOURCES_PER_TASK` (default `3`)
- `MAX_RETRIES` (default `4`)
- `RETRY_BASE_MINUTES` (default `5`)
- `LOOP_INTERVAL_MINUTES` (default `60`)
- `LOOP_MAX_CYCLES` (optional)
- `STATE_FILE` (optional custom path)
- `LOOP_LOCK_FILE` (optional custom path)
- `LOCK_STALE_MINUTES` (default `180`)

## Production Notes

- Run `loop:daemon` under a process supervisor for long-running environments.
- Use `--json` logs for ingestion into observability pipelines.
- Keep Browserbase credentials in a secure secret manager.
- Review and rotate provider API keys regularly.

## Validation

```bash
bun run typecheck
bun test
```

## License

MIT
