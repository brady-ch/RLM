# Research Questions

## 2026-05-10 — Typed Artifact + External State Runtime (ARTF-01)

1. Which backend pattern best fits long-running recursive executions with frequent, small mutations: embedded SQLite, Postgres, document store, or event-log + materialized views?
2. What query model should be first-class for node execution: point lookups by `run_id`/`segment_id`, path-filtered state reads, and snapshot-at-version reads?
3. What optimistic concurrency strategy should be canonical (`etag`, monotonic `version`, vector clock), and how should retries/backoff be surfaced to node runtimes?
4. How should path-level mutation ACL be expressed and enforced (per node type, per edge, or per capability token)?
5. What audit record shape is sufficient for replay/debug at book scale (before/after hash, actor node id, allowed paths, rejection reason, latency)?
6. What state compaction/checkpoint strategy keeps full-book workflows resumable without unbounded state growth?
