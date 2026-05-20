# Desktop Packaging

`npm run package:smoke` builds the TypeScript CLI, builds the React UI, stages a desktop-ready release folder, and verifies required launch assets.

Native shell entry points:

```bash
npm run tauri:dev
npm run tauri:build
```

The Tauri config lives under `src-tauri/` and uses the React UI build as its frontend bundle.

The staged release is written to:

```text
dist/release/<platform>-<arch>/
```

Contents:

- `bin/node` or `bin/node.exe` - Node runtime copied from the packaging host for this platform.
- `dist/src/index.js` - packaged CLI/control-server entry.
- `ui-dist/` - static UI assets.
- `rlm` and `rlm.cmd` - Unix and Windows launch shims that prefer the bundled runtime.
- `ensure-ollama.mjs` - readiness helper for an existing or managed Ollama endpoint.
- `desktop-manifest.json` - platform, bundled runtime, launch, UI, and Ollama metadata for installer tooling.

The staged launcher does not require a user-installed Node/npm on the same platform it was packaged for. Set `NODE_BINARY` only when intentionally overriding the bundled runtime during development.

Ollama behavior:

- By default, the helper checks `OLLAMA_HOST` or `http://127.0.0.1:11434`.
- Set `RLM_MANAGE_OLLAMA=1` to let the helper start `ollama serve`.
- The helper exits non-zero if Ollama is unavailable and unmanaged.

This release folder is the Phase 23 installer input. Native signing/notarization and store distribution remain outside v1.3.
