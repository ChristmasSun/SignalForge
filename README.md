# SignalForge

SignalForge turns rough research notes into auto-generated findings in your Obsidian vault.
Runtime: Bun `>=1.3.0`.

## What It Does
- Reads all markdown files in your vault.
- Detects research intents from:
  - explicit `#investigate ...` tags
  - heuristic phrases like `read about X`, `wondering what Y is`, `something about Z`
- Runs layered research:
  - Browserbase session mode when API key + project ID are configured
  - provider fallback chain: SerpAPI -> Tavily -> Bing RSS
  - page content extraction for top sources
- Scores and deduplicates sources by domain/quality.
- Synthesizes insight bullets with citation checks and confidence breakdown.
- Persists task state (`pending`/`in_progress`/`done`/`failed`) with retry backoff.
- Supports incremental runs and `--since` filtering.
- Writes structured findings to `Inbox/Findings` and back-links them to source notes.

## Setup
```bash
bun install
cp .env.example .env
```

Then set env vars in your shell or `.env` loader:
- `VAULT_DIR` (required)
- `BROWSERBASE_API_KEY` + `BROWSERBASE_PROJECT_ID` (for Browserbase mode)
- `BROWSERBASE_CONTEXT_ID` (optional, persistent state)
- `SERPAPI_API_KEY` and/or `TAVILY_API_KEY` (optional fallback providers)

## Commands
Initialize directories/state:
```bash
VAULT_DIR="/path/to/vault" bun run src/cli.ts init
```

Run:
```bash
VAULT_DIR="/path/to/vault" bun run run
```

Run with filters/options:
```bash
VAULT_DIR="/path/to/vault" bun run src/cli.ts run --since=7d --json
VAULT_DIR="/path/to/vault" bun run src/cli.ts run --force
VAULT_DIR="/path/to/vault" bun run dry
```

Show task state summary:
```bash
VAULT_DIR="/path/to/vault" bun run src/cli.ts status
```

Rerun a specific query:
```bash
VAULT_DIR="/path/to/vault" bun run src/cli.ts rerun "letta code"
```

Replay Browserbase metadata for a prior task:
```bash
VAULT_DIR="/path/to/vault" bun run src/cli.ts replay "letta code"
# or by session id
VAULT_DIR="/path/to/vault" bun run src/cli.ts replay "bb_session_id"
# auto-open replay/live url when available
VAULT_DIR="/path/to/vault" bun run src/cli.ts replay "letta code" --open
```

Run a scheduled loop (in-process):
```bash
VAULT_DIR="/path/to/vault" bun run src/cli.ts loop --interval-minutes=60 --max-cycles=8
```

Run loop as background daemon:
```bash
VAULT_DIR="/path/to/vault" bun run src/cli.ts loop --daemon --interval-minutes=60
```

## Validation
```bash
bun run typecheck
bun test
```

## Suggested note format
```md
- #investigate Letta code and how it can augment my codeflow
- #investigate ZoComputer and practical use-cases
```

This tool also picks up natural phrases like:
- `read about Letta code`
- `wondering what ZoComputer is`
- `something about ZoComputer`

## State File
- Default state path: `<VAULT_DIR>/.signalforge/state.json`
- Stores retries, last success/failure timestamps, and finding links for each task.
- Stores last Browserbase session metadata for `replay`.
- Default lock file: `<VAULT_DIR>/.signalforge/loop.lock` to prevent overlapping loop workers.
