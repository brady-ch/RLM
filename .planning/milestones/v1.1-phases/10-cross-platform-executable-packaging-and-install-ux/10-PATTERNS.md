# Phase 10 — Pattern Map

**Purpose:** Closest analogs in-repo for packaging, CLI boot, config load, and UI static serving.

| Planned touchpoint | Role | Closest analog | Notes |
|--------------------|------|----------------|-------|
| `package.json` scripts | Release/automation entry | Existing `build`, `build:ui`, `start` | Extend with `package:*` targets; keep `bin.rlm` for dev |
| `src/index.ts` | CLI composition, mode routing | Current `main()` flow | Inject first-run prompt before heavy init; thread `uiDistDir` resolution |
| `src/cli/args.ts` | Flags and `help` | `parseArgs`, `helpText()` | Add non-interactive bypass env for CI |
| `src/application/project-config.ts` | Config load + validation | `loadProjectConfig`, `findDefaultConfigPath` | Replace single-file discovery with scoped dirs + merge |
| `src/application/control-server.ts` | UI HTTP surface | `serveUiAsset`, `uiDistDir` option | Packaged layout must resolve `uiDistDir` relative to app root |
| `ui/vite.config.ts` | Build out dir | `outDir` / `base` | Align packaged asset path with server resolution |
| `.github/workflows/*.yml` | CI matrix | Add if absent | Three OS targets per roadmap |

## PATTERN MAPPING COMPLETE
