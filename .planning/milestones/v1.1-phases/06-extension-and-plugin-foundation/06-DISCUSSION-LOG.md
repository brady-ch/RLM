# Phase 6: Extension and Plugin Foundation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-09
**Phase:** 6-Extension and Plugin Foundation
**Areas discussed:** Discovery surface, Trust model, Extension taxonomy, Migration of built-ins

---

## Discovery surface

| Option | Description | Selected |
|--------|-------------|----------|
| YAML-first | Extensions enabled and referenced from `rlm.config.yaml`; loader resolves paths | ✓ (with folder layout + packaged builtins) |
| API-first | TS entry registration; minimal YAML | |
| Hybrid | YAML + register hook per module | Considered; user preferred YAML-first with explicit folder story |

**User's choice:** YAML-first; YAML remains the operator-facing surface; extensions live in a documented folder (packaged builtins + project-local user extensions); single CLI executable flow.
**Notes:** User asked for pros/cons; after tradeoffs, chose YAML-first and asked if executable + exposed YAML + folder layout is possible — confirmed yes with packaged vs project-local split.

---

## Trust model

| Option | Description | Selected |
|--------|-------------|----------|
| Workspace-relative only | Strict path roots | |
| Named allowlist | Package/name allowlist | |
| First-load explicit confirm | Prompt + persisted approvals for new extension identities | ✓ |
| Dev-permissive two-tier | Warn in dev, strict in prod | |

**User's choice:** First-load explicit confirmation with persisted allowlist.
**Notes:** Aligns with product value of no silent execution of new code paths.

---

## Extension taxonomy

| Option | Description | Selected |
|--------|-------------|----------|
| One registry with kinds | Discriminated union of extension kinds | |
| Parallel registries + facade | Separate tool / skillLoader / modelHost registries behind one host/facade | ✓ |
| Defer taxonomy | Tools-only until later phases | |

**User's choice:** Parallel registries behind a single facade.

---

## Migration of built-ins

| Option | Description | Selected |
|--------|-------------|----------|
| First-party bundled | Builtins ship as first-party extension modules using same loader | ✓ |
| Core wrappers | Short-term special-case in core | |
| Big-bang move to repo ./extensions | All builtins only in repo tree | |

**User's choice:** First-party bundled modules inside the package, same registration pipeline as third-party.

---

## Claude's Discretion

- Path resolution tie-breaks and allowlist file format (see CONTEXT.md).

## Deferred Ideas

- None captured beyond normal phase boundaries (MCP, hosts, chat) listed in CONTEXT deferred section.
