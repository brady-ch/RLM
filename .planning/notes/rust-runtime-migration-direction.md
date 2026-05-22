# Rust Runtime Migration Direction

**Date:** 2026-05-22  
**Context:** `$gsd-explore` — evaluate Rust for performance, lower-level ML/inference control, and removing Node from the shipped desktop app while keeping the UI in TypeScript.

## Decision summary

| Area | Direction |
|------|-----------|
| **UI** | Keep TypeScript/React in Tauri webview; Vite build produces static assets only |
| **Runtime** | Rewrite orchestration, control server, persistence, and adapters in Rust |
| **Shipped bundle** | Remove bundled Node runtime; Tauri hosts Rust core directly |
| **Fine-tuning** | **Out of scope** for now — no in-app training |
| **Hugging Face** | Inference path only: search, artifact download, GGUF registry, handoff to Ollama or in-process llama.cpp |
| **Python** | Not in scope — Rust + Ollama/llama.cpp only |

## Target architecture

```text
┌─────────────────────────────────────┐
│  UI (TypeScript/React in webview)   │
│  graph · approvals · model library    │
└──────────────┬──────────────────────┘
               │ HTTP/SSE (localhost)
┌──────────────▼──────────────────────┐
│  Rust runtime (rlm-core)            │
│  recursive engine · graph executor  │
│  control server · session/memory    │
│  vector index · model host adapters │
└──────────────┬──────────────────────┘
               │ HTTP / optional in-proc
┌──────────────▼──────────────────────┐
│  Ollama / llama.cpp (inference)     │
└─────────────────────────────────────┘
```

## Migration priority (Rust)

1. **Control server + session/graph APIs** — preserve existing UI contract; transport-only boundary already exists in TS
2. **Recursive engine + graph executor** — largest logic block; current `ports/` map cleanly to Rust traits
3. **Persistence** — run state, session memory, preferences (already file-based)
4. **Vector + embedding layer** — first measurable perf win vs JSON linear scan (`FileVectorIndex`, brute-force cosine)
5. **Model host adapters** — Ollama HTTP; optional managed llama.cpp per existing seeds
6. **CLI entrypoint** — thin Rust binary replacing `dist/src/index.js`

## Explicitly deferred

- Fine-tuning / LoRA / QLoRA workflows (compute and ecosystem cost; revisit as separate milestone)
- Full rewrite of React UI
- Replacing Ollama on day one — strangler path keeps Ollama as default host while Rust core matures

## Relationship to current work

- **v1.7** (plugin taxonomy, strangler extractions) should complete or reach a stable seam before large Rust port begins
- Existing architectural boundaries (`ports/`, control-server handlers, bootstrap composition) are the migration map — extract behavior-preserving APIs first in TS if needed, then port module-by-module
- Tauri shell today spawns Node child for `rlm ui`; end state is Tauri embedding Rust server + static UI without child Node process

## Success criteria (when this direction ships)

- Desktop `.deb`/installer contains no bundled Node runtime
- UI loads from static assets; all execution APIs served by Rust
- Session memory + vector retrieval meet or exceed current behavior with sub-linear search at scale
- Hugging Face catalog/download path works without Python
- `npm run check` green for UI/build toolchain; Rust workspace has equivalent CI gate

## References

- `.planning/notes/desktop-product-vision.md`
- `.planning/seeds/managed-llama-cpp-runtime.md`
- `.planning/seeds/rust-vector-index.md`
- `src-tauri/src/main.rs` (current Node child lifecycle)
