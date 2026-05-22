# Research Questions

## 2026-05-10 — Typed Artifact + External State Runtime (ARTF-01)

1. Which backend pattern best fits long-running recursive executions with frequent, small mutations: embedded SQLite, Postgres, document store, or event-log + materialized views?
2. What query model should be first-class for node execution: point lookups by `run_id`/`segment_id`, path-filtered state reads, and snapshot-at-version reads?
3. What optimistic concurrency strategy should be canonical (`etag`, monotonic `version`, vector clock), and how should retries/backoff be surfaced to node runtimes?
4. How should path-level mutation ACL be expressed and enforced (per node type, per edge, or per capability token)?
5. What audit record shape is sufficient for replay/debug at book scale (before/after hash, actor node id, allowed paths, rejection reason, latency)?
6. What state compaction/checkpoint strategy keeps full-book workflows resumable without unbounded state growth?

## 2026-05-22 — Rust Vector + Inference Crate Selection (Rust runtime migration)

Exploration context: Rust backend + TypeScript UI; no fine-tuning in scope; prioritize vector search perf and optional HF GGUF inference without Python.

1. Which embedded ANN crate best fits desktop constraints (single-user, on-disk persistence, session merge, no cloud): `usearch`, `hnsw_rs`, `instant-distance`, sqlite-vec via rusqlite, or Qdrant embedded?
2. What persistence format supports incremental upsert and session-scoped merge without full reindex on every save/reopen?
3. For embeddings during Rust migration, is Ollama HTTP sufficient as v1 default, or should `fastembed-rs` / candle be bundled for offline/low-latency embed?
4. For managed GGUF inference (complement to Ollama), compare `llama-cpp-2`, `candle`, and `ort` on: GGUF support, GPU backends (CUDA/Metal/Vulkan), streaming API fit for recursive engine tool rounds, and binary size in Tauri bundle.
5. What is the strangler migration order that keeps the React UI on unchanged HTTP/SSE contracts while swapping TS control server for Rust — module boundary map and parity test strategy?
6. Hugging Face artifact flow in Rust: does `hf-hub` + manual GGUF detection cover model library needs, or is a thin compatibility layer required for Ollama import mapping?
