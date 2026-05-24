---
title: Seed Backlog Resolution
date: 2026-05-24
context: /gsd-explore — finish seeds without phases
---

## Decision

Archive nine shipped seeds and route four active feature seeds into two new milestones plus a documentation audit phase.

## Milestone split

| Milestone | Phases | Seeds |
|-----------|--------|-------|
| v1.21 Inference Expansion | 136–140 | `managed-llama-cpp-runtime`, `multi-runner-adapters` |
| v1.22 Agent Primitives | 141–144 | `loop-controller-structured-artifacts-and-implementation`, `specialized-tool-surfaces` |
| v1.23 Documentation & Architecture Audit | 145 | (meta — no seed) |

## v1.21 scope decision

**Full managed llama.cpp** in v1.21 (not external-handoff-only). Rationale:

- HF GGUF download/registry already exists in Rust (`hf_registry.rs`, model library service)
- Remaining work is process supervision + `LanguageModelPort` adapter + multi-runner registry
- External-handoff-only would defer the primary user value (one-click local GGUF inference)

## Archived seeds (shipped)

| Seed | Shipped in |
|------|------------|
| `rust-application-layer-architecture-pass` | Phases 91–96 (v1.15–16) |
| `first-class-plugin-taxonomy-for-future-tools` | Phase 46 (v1.7) |
| `save-graph-as-workflow` | Phase 34 (v1.6) |
| `vector-memory-retrieval` | v1.4 memory block |
| `ui-component-extraction` | Phase 61 (v1.8); continued in v1.19 |
| `rust-crate-split` | Phase 71 (v1.9) |
| `remote-plugin-fetch-to-local-folder` | Rust `remote_fetch` + registry install |
| `rust-vector-index` | `AnnVectorIndex` + USEARCH + Phase 100 |
| `zero-doc-first-run-mvp-north-star` | Principle embedded in v1.20 Phase 135 UAT |

## Active seeds (phased)

| Seed | Milestone |
|------|-----------|
| `managed-llama-cpp-runtime` | v1.21 Phases 137–138 |
| `multi-runner-adapters` | v1.21 Phases 139–140 |
| `loop-controller-structured-artifacts-and-implementation` | v1.22 Phases 141–142 |
| `specialized-tool-surfaces` | v1.22 Phases 143–144 |

## Already phased (prior explore sessions)

| Seed | Milestone |
|------|-----------|
| `rust-infrastructure-layer-architecture-pass` | v1.17 (97–112) |
| `node-runtime-retirement` | v1.18 (113–120) |
| `constrained-ollama-tool-envelope` | Phase 120 |
| `ui-product-simplification` | v1.19 (121–128) |
| `product-desktop-outcome-milestone-pass` | v1.20 (129–135) |

## Phase 145 intent

Post-milestone documentation and architecture audit:

- Refresh AGENTS.md, PROJECT.md, research architecture docs
- Re-run boundary checks; remove stale baseline entries
- Confirm seed backlog state (archived vs active triggers)
- Catalogue doc drift and deferred debt with disposition

## References

- `.planning/ROADMAP.md` — Phases 136–145
- `.planning/seeds/` — archived seed frontmatter updated 2026-05-24
