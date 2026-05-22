---
phase: 50-remote-fetch
plan: 01
subsystem: plugins
tags: [remote-fetch, tar, git-clone, zip-slip, plugin-doctor, security]

requires:
  - phase: 49-local-plugin-manager
    provides: PluginRegistryService, local install catalog, doctor reporting
provides:
  - HTTPS archive install via fetch-to-staging with manifest-only validation
  - git: URL install via spawn-only clone
  - Archive zip-slip defenses and size limits
  - rlm plugin doctor --fix quarantine and stale config pruning
affects: [51-plugin-manager-ui]

tech-stack:
  added: [tar@^7.5.15]
  patterns:
    - "Remote install previews without --yes; confirm gate before catalog write"
    - "doctor({ fix: true }) never runs silently — CLI requires explicit --fix"
    - "Fetch-to-staging → validate manifest → confirm → atomic cp to ~/.rlm/plugins/<id>/"

key-files:
  created:
    - src/plugins/remote-fetch/archive-extract.ts
    - src/plugins/remote-fetch/git-fetch.ts
    - src/plugins/remote-fetch/index.ts
    - tests/plugins/remote-fetch.test.ts
  modified:
    - src/application/plugins/plugin-registry-service.ts
    - src/cli/run-modes/plugin-commands.ts
    - src/cli/args.ts
    - src/application/control-server/handlers/plugins.ts

key-decisions:
  - "50MiB max download and 100MiB max extract for remote archives"
  - "git: prefix URLs use git clone --depth 1 only; no npm install or hooks during fetch"
  - "Invalid catalog entries quarantined to ~/.rlm/plugins/.quarantine/<timestamp>-<id>/"

requirements-completed: [RMT-01, RMT-02, RMT-03, RMT-04]

duration: 45min
completed: 2026-05-22
---

# Phase 50 Plan 01: Remote Fetch Summary

**HTTPS `.tar.gz`/`.tgz` and optional `git:` remote install with zip-slip defenses, confirm gate, and explicit `doctor --fix` quarantine**

## Performance

- **Duration:** 45 min
- **Started:** 2026-05-22T18:00:00Z
- **Completed:** 2026-05-22T18:45:00Z
- **Tasks:** 4
- **Files modified:** 16

## Accomplishments

- `rlm plugin install <https-url>` fetches archives, validates manifest without executing plugin code, previews until `--yes`, then installs to `~/.rlm/plugins/<id>/`
- Archive extraction rejects path traversal and enforces documented size caps
- `git:` URLs use `git clone --depth 1` spawn only — no remote code execution during fetch
- `rlm plugin doctor --fix` quarantines invalid catalog entries and prunes stale YAML refs; repair never runs without `--fix`

## Task Commits

1. **Task 1: Remote fetch transport** - `1b3fac0` (feat)
2. **Task 2: Registry installRemote and doctorFix** - `71aa328` (feat)
3. **Task 3: CLI and control-server wiring** - `451a720` (feat)
4. **Task 4: Tests** - `ea86717` (test)

**Plan metadata:** `347b5e6` (docs: complete plan)

## Files Created/Modified

- `src/plugins/remote-fetch/` - HTTPS fetch, safe tar extract, git spawn fetch
- `src/application/plugins/plugin-registry-service.ts` - `installRemote`, `doctor({ fix })`
- `src/cli/run-modes/plugin-commands.ts` - URL install, `--yes`, `--fix`
- `tests/plugins/remote-fetch.test.ts` - zip-slip, git spawn, archive extract tests

## Decisions Made

- Confirm gate returns preview JSON/stdout unless `--yes` — no silent remote installs
- Quarantine moves broken install dirs under `~/.rlm/plugins/.quarantine/` instead of deleting
- Control-server `/api/plugins/doctor/fix` requires explicit POST (mirrors CLI `--fix`)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Tar filter throw caused uncaughtException in zip-slip test**
- **Found during:** Task 4
- **Issue:** Throwing inside `tar.x` filter bypassed promise rejection handling
- **Fix:** Record rejected path in filter, throw after extract completes
- **Files modified:** `src/plugins/remote-fetch/archive-extract.ts`
- **Commit:** `1b3fac0` (amended in subsequent build)

None otherwise — plan authored during execution from ROADMAP requirements.

## Issues Encountered

None blocking.

## User Setup Required

None — `git` optional for `git:` URLs; HTTPS archives work with Node fetch only.

## Next Phase Readiness

- Phase 51 UI can expose remote install URL field and doctor fix action via existing `/api/plugins` routes
- Remote install preview/confirm semantics align with CLI `--yes` for UI trust prompts

## Self-Check: PASSED

- FOUND: src/plugins/remote-fetch/index.ts
- FOUND: tests/plugins/remote-fetch.test.ts
- FOUND: 1b3fac0, 71aa328, 451a720, ea86717

---
*Phase: 50-remote-fetch*
*Completed: 2026-05-22*
