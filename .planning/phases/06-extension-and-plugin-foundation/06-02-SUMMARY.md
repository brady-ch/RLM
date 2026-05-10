---
phase: 06-extension-and-plugin-foundation
plan: 06-02
subsystem: extension
tags: [extensions, plugins, tools, tests]
requires:
  - phase: 06-extension-and-plugin-foundation
    provides: Extension contracts, ExtensionHost, and extension config schema
provides:
  - First-party tool registration shims
  - CLI composition through ExtensionHost
  - Integration tests for third-party loading, malformed modules, duplicates, and builtins
  - Operator documentation for extension allowlists and non-TTY behavior
affects: [phase-07-mcp-and-skills, phase-08-model-hosts]
tech-stack:
  added: []
  patterns: [first-party extension shims, non-tty preapproval, no direct CLI tool construction]
key-files:
  created:
    - src/extensions/tools/guarded-shell.extension.ts
    - src/extensions/tools/web-search.extension.ts
    - src/extensions/tools/web-fetch.extension.ts
    - src/extensions/tools/workspace-file-write.extension.ts
    - tests/extension-host.test.ts
  modified:
    - src/index.ts
    - .planning/phases/06-extension-and-plugin-foundation/06-VALIDATION.md
key-decisions:
  - "Built-in tools register through first-party extension shim modules loaded by ExtensionHost.loadBuiltins()."
  - "External extension loading is interactive only when stdin and stdout are TTYs."
  - "CI/non-TTY extension loading requires a pre-approved allowlist."
patterns-established:
  - "Composition root imports shim modules, not adapter classes."
  - "Agent tool resolution uses extensionHost.tools.get(toolName)."
requirements-completed: [PLUG-01]
duration: 25min
completed: 2026-05-10
---

# Phase 6 Plan 06-02 Summary

**Built-in tools now load through extension shims, and third-party tool registration is covered by integration tests**

## Performance

- **Duration:** 25 min
- **Started:** 2026-05-10T02:35:00Z
- **Completed:** 2026-05-10T03:00:00Z
- **Tasks:** 3
- **Files modified:** 9

## Accomplishments

- Added four first-party extension shims for `shell`, `write_file`, `web_search`, and `web_fetch`.
- Rewired `src/index.ts` to instantiate `ExtensionHost`, load built-ins through `loadBuiltins`, optionally load configured external extensions, and resolve agent tools from the host registry.
- Added integration coverage for approved third-party extension loading, missing `register` rejection, duplicate tool-name rejection, and synthetic built-in registration without allowlist.
- Updated the Phase 6 validation map with actual test names and non-TTY behavior.

## Extension Contract

External extension modules must be ESM modules that export:

```typescript
export function register(host: ExtensionHost): void
```

The `register` function receives the live `ExtensionHost` and can call registry methods such as `host.tools.register(tool)`.

## Allowlist Format

The default allowlist path is `.rlm-allowlist.json` next to the active config file. A configured `extensions.allowlist` path is resolved relative to that config file unless it is absolute.

Entries are JSON object properties keyed by the SHA-256 hash of the resolved absolute extension path:

```json
{
  "sha256-of-absolute-path": "/absolute/path/to/extension.mjs"
}
```

`ExtensionHost.loadExternal()` checks this allowlist before calling `import()`. If the extension is not approved and the CLI is attached to a TTY, the user is prompted. In non-TTY/CI runs, extension loading fails unless the allowlist already contains the resolved path. Tests can use `preApprove(absPath, allowlistPath)`.

## Task Commits

1. **Task 4: Create first-party extension shims and rewire index.ts** - `0d8f327` (`feat(06-02): load builtin tools through extensions`)
2. **Task 5: Integration tests for ExtensionHost** - `6e82a93` (`test(06-02): cover extension host integration`)
3. **Task 6: Phase summary for operators and extension authors** - summary commit follows this file.

## Files Created/Modified

- `src/extensions/tools/guarded-shell.extension.ts` - Registers `GuardedShellTool`.
- `src/extensions/tools/web-search.extension.ts` - Registers `WebSearchTool`.
- `src/extensions/tools/web-fetch.extension.ts` - Registers `WebFetchTool`.
- `src/extensions/tools/workspace-file-write.extension.ts` - Registers `WorkspaceFileWriteTool`.
- `src/index.ts` - Uses `ExtensionHost` for built-in and configured extension loading, and resolves tools through the extension registry.
- `tests/extension-host.test.ts` - Integration coverage for PLUG-01 behaviors.
- `.planning/phases/06-extension-and-plugin-foundation/06-VALIDATION.md` - Execution-time validation notes.

## Decisions Made

- Non-TTY runs use `interactive: false`; this prevents hidden prompts in CI and forces explicit allowlist setup.
- No new CLI flag was added in Phase 6; allowlist preapproval is the documented non-interactive path.
- Adapter classes remain unchanged in `src/adapters/`; shims isolate registration from implementation.

## Deviations from Plan

None - plan executed exactly as written.

**Total deviations:** 0 auto-fixed.
**Impact on plan:** None.

## Issues Encountered

- The sandbox blocks localhost binding, so `npm test` needs elevated permission for the existing control-server test. With that permission, all tests pass.

## Verification

- `npm run build` - passed.
- `npm test` - passed, 63 tests.
- `node dist/src/index.js --help` - passed.
- `rg "new (GuardedShellTool|WebSearchTool|WebFetchTool|WorkspaceFileWriteTool)" src/index.ts` - no matches in `src/index.ts`.
- `git diff -- src/ports/language-model-port.ts` - empty.

## User Setup Required

None for default built-in tools. External extension users must configure `extensions.load[]` and approve extension paths interactively once, or provide a pre-approved `.rlm-allowlist.json` for non-TTY/CI runs.

## Next Phase Readiness

Phase 7 can build MCP and skill loading on the same `ExtensionHost` registration path. Phase 8 can register model host adapters through the existing model-host registry without changing `LanguageModelPort`.

## Self-Check: PASSED

All tasks, acceptance criteria, success criteria, and plan-level verification completed.
