# External Integrations

## Snapshot
- Date: 2026-05-08
- Integration style: mostly local-first runtime with outbound HTTP for model/search/fetch.

## LLM Provider Integration
- Ollama integration via `@langchain/ollama` and direct fetch fallback in:
  - `src/adapters/ollama-language-model.ts`
- Default endpoint behavior:
  - base URL defaults to `http://127.0.0.1:11434`
  - unload API call used at `/api/generate` path handling logic.
- Configurable inputs:
  - CLI `--base-url`
  - environment variable `OLLAMA_HOST`

## Web Search Integration
- DuckDuckGo Lite query integration in:
  - `src/adapters/web-search-tool.ts`
- External endpoint:
  - `https://lite.duckduckgo.com/lite/`
- Fetch path:
  - uses `fetch` or `curl` execution via `execFile` fallback.

## Web Fetch Integration
- Generic page fetch integration in:
  - `src/adapters/web-fetch-tool.ts`
- Supported content types:
  - HTML/plain text/xhtml-derived responses.
- Purpose:
  - fetch and section-rank content for research flows.

## Local Process / System Integrations
- Shell command execution integration in:
  - `src/adapters/guarded-shell-tool.ts`
- Node subprocess integration in:
  - `src/application/workflow-runner.ts` (`execFile` for validation commands)
- File write integration in:
  - `src/adapters/workspace-file-write-tool.ts`

## Local UI Control Surface
- HTTP server integration for interactive flow:
  - `src/application/control-server.ts`
- Event stream:
  - Server-Sent Events endpoint pushes execution events.

## Authentication and Third-Party SaaS
- No OAuth/OpenID provider integrations found.
- No payment gateways found.
- No cloud database SDK integrations found.

## Webhooks / Async External Callbacks
- No webhook receiver implementation found in current source tree.

## Integration Risk Notes
- Search adapter depends on external website behavior and HTML parsing stability.
- Local shell/curl reliance can vary by environment.
- Ollama availability and model presence are hard runtime prerequisites.
