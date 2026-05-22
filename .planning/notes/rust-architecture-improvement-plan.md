---
title: Rust Architecture Improvement Plan
date: 2026-05-22
context: "$gsd-explore — post-v1.8 functional debt and structural cleanup for rlm-core"
---

# Rust Architecture Improvement Plan

**Date:** 2026-05-22  
**Context:** `$gsd-explore` — v1.8 shipped Rust runtime (~16k LOC, 87 `.rs` files). Functional debt closes first; structural work follows the v1.6/v1.7 TypeScript cleanup patterns never applied to Rust.

## Priority

1. **Wave 1 — Functional debt** (behavior parity, user-visible gaps)
2. **Wave 2 — Structural architecture** (layers, file splits, enforcement)

Wave 1 sequencing after quick UI fixes: **F1 quality loop → F2 resume → F3 skills → F4 CLI → F6 packaging** (F5 UI regressions first).

## Current baseline

| Area | State |
|------|-------|
| Module tree | `domain/`, `ports/`, `adapters/`, `persistence/`, `plugins/`, `interop/`, plus flat orchestration (`execution/`, `graph/`, `memory/`, `control_server/`, `bootstrap/`) |
| Boundary violation | `domain/run_state_persistence.rs` imports concrete `FileRunStateStore` |
| Monoliths | `control_server/routes.rs` (1,525 lines), `recursive_language_model.rs` (1,062), `session_graph.rs` (933) |
| Enforcement | No Rust depcruise; `AGENTS.md` documents TS layers only |
| Functional gaps | Quality loop simplified, resume cursor write-only, skill interop missing, CLI stubs, UI regressions, PACK-03 deferred |

## Wave 1 — Functional debt

| Phase | ID | Scope | Key files |
|-------|-----|-------|-----------|
| F5 | UI regressions | Restore pause-auto-approvals, HF download wiring, sign REG-01 UAT | `ui/`, `control_server/routes.rs` |
| F1 | Quality loop | Port `quality-loop.ts` → `domain/recursion/quality_loop.rs`; full draft/critique/refine/gate/best-of | `recursive_language_model.rs`, TS `quality-loop.ts` |
| F2 | Resume consumer | Read `resumeCursor` on graph entry; control-server resume; TS cursor parity | `graph/executor.rs`, `run_state_persistence.rs`, `PERS-03-GAP.md` |
| F3 | Skill interop | Port `mcp-skill-runtime.ts`; register `skill` tool; path policies | `interop/`, `plugins/runtime.rs` |
| F4 | CLI parity | `plan-node`, workflow export/import, session/memory flags, full `args.ts` surface | `rlm-cli/`, `bootstrap/cli_runtime.rs` |
| F6 | PACK-03 | Headless `.deb` smoke in CI (Docker/xvfb) | packaging scripts, CI |

See `.planning/todos/pending/rust-functional-debt-wave1.md` for acceptance criteria.

## Wave 2 — Structural architecture

| Phase | ID | Scope | TS analogue |
|-------|-----|-------|-------------|
| A1 | Domain boundary | `RunStateStorePort` trait; domain/application inject port, not `FileRunStateStore` | v1.7 ARCH-02 |
| A2 | Application layer | Group `execution/`, `graph/`, `memory/`, `config/`, `bootstrap/` under `application/` | v1.6 Phase 45 |
| A3 | Handler split | Split `routes.rs` → `handlers/{session,graph,memory,...}.rs` | v1.6 Phase 41 |
| A4 | File decomposition | Split large files (orchestrator, session_graph, registry_service, config) | v1.6 Phases 37, 40 |
| A5 | Boundaries + docs | Rust concern map in `AGENTS.md`; `check-rust-boundaries` in `check:rust` | v1.7 Phases 47–48 |
| A6 | Crate split | Optional `rlm-ports` + `rlm-domain` when compile iteration hurts | — |

Pending TS todos map to Rust:

- `extract-runtime-composition-from-cli-entrypoint` → A2 (`bootstrap/`, `control_server/mod.rs`)
- `split-config-loader-resolver-validation` → A4 (`persistence/config.rs`)

See `.planning/todos/pending/rust-structural-architecture-wave2.md` for acceptance criteria.

## Suggested roadmap phases (62–71)

| Phase | Wave | Deliverable |
|-------|------|-------------|
| 62 | F5 | UI regression fixes + REG-01 UAT |
| 63 | F1 | Quality loop port |
| 64 | F2 + A1 | Resume consumer + run-state port |
| 65 | F3 | Skill interop |
| 66 | F4 | CLI full parity |
| 67 | F6 | PACK-03 CI smoke |
| 68 | A2–A3 | Application layer + handler split |
| 69 | A4 | Large file decomposition |
| 70 | A5 | Rust boundaries + AGENTS.md |
| 71 | A6 | Crate split (optional) |

## References

- `.planning/STATE.md` — deferred items
- `.planning/milestones/v1.8-phases/01-close-v1-8-tech-debt-ui-regressions-mcp-client-cli-parity-ru/PERS-03-GAP.md`
- `.planning/milestones/v1.8-MILESTONE-AUDIT.md`
- `.planning/notes/rust-runtime-migration-direction.md`
- `.planning/seeds/rust-crate-split.md`
