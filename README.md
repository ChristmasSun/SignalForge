# SignalForge (v1 MVP)

SignalForge turns rough research notes into auto-generated findings in your Obsidian vault.

## What this version does
- Reads all markdown files in your vault.
- Detects research intents from:
  - explicit `#investigate ...` tags
  - heuristic phrases like `read about X`, `wondering what Y is`, `something about Z`
- Runs research:
  - Browserbase session mode when API key + project ID are configured
  - fallback HTTP search mode otherwise
- Writes structured findings to `Inbox/Findings`.
- Includes session metadata so each finding can link back to Browserbase runs.

## Setup
```bash
npm install
cp .env.example .env
```

Then set env vars in your shell or `.env` loader:
- `VAULT_DIR` (required)
- `BROWSERBASE_API_KEY` + `BROWSERBASE_PROJECT_ID` (for Browserbase mode)
- `BROWSERBASE_CONTEXT_ID` (optional, persistent state)

## Run
```bash
VAULT_DIR="/path/to/vault" npm run run
```

Dry run (extract tasks only):
```bash
VAULT_DIR="/path/to/vault" npm run dry
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

## Publish to GitHub
```bash
git init
git add .
git commit -m "Initial commit: SignalForge MVP"
git branch -M main
git remote add origin https://github.com/vedan/BrowserbaseObsidian.git
git push -u origin main
```
