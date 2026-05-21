# Phase 28 Context: Semantic Retrieval Pipeline

## Goal

Add local semantic retrieval over structured memory and episodic entries without making vectors the canonical source of truth.

## Decisions

- Use a local JSON vector index under `.rlm/memory/vector-index.json`.
- Use Ollama embeddings as the first provider, defaulting to `nomic-embed-text`.
- Retrieval only runs when a node policy includes `relevant memory entries`.
- Retrieval failures degrade visibly in packet metadata and memory inspection; model calls still proceed with structured memory.
- Vector index metadata is rebuildable and not required for saved-session restore correctness.
