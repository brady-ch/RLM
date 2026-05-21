# Phase 26: Structured Memory Store and Resolver - Context

**Gathered:** 2026-05-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 26 implements canonical structured memory and episodic continuity on top of the Phase 25 saved-session contract. It adds a memory store, authorization/audit semantics, deterministic rolling summaries, and bounded memory context packets. It does not implement preference UX or semantic/vector retrieval behavior.

</domain>

<decisions>
## Implementation Decisions

### Memory Scope Model
- The canonical structured memory primitive is a versioned scope document keyed by `scopeId`, stored through `MemoryStorePort` and serializable into the Phase 25 snapshot sections.
- Scope lifetimes are `session`, `project`, and `permanent`. `session` is the default; longer lifetimes must be explicit.
- Runtime must enforce node `contextPolicy.memoryScopes`, `reads`, and `writes`. Unauthorized writes are rejected with audit entries.
- Scope patch conflicts use optimistic version/etag checks. Rejected conflicts are audited and surfaced as degraded memory events.

### Context Packet Injection
- `MemoryResolver` belongs in the application layer. It builds bounded context packets before model completion using node/sub-call policy.
- Phase 26 packets include authorized structured scopes, rolling episodic summary, provenance, and truncation/degraded metadata. Vector hits are deferred.
- Packet limits should parse/enforce existing `contextPolicy.limits` as conservative character budgets with deterministic truncation.
- Store last packet metadata per node/session for inspection, but do not store sensitive full prompt dumps by default.

### Episodic Log and Summaries
- Episodic entries include node events, short summaries, artifact refs, accepted/rejected scope writes, and degraded memory events.
- Rolling summaries are deterministic bounded summaries from recent episodic entries. Model-generated compression is deferred.
- Memory read/write/summary failures degrade visibly but do not fail node completion unless required state is missing.
- Phase 26 stops at structured memory, resolver, and episodic log. Preference UX remains Phase 27; vector retrieval remains Phase 28.

</decisions>

<code_context>
## Existing Code Insights

- Phase 25 added `SessionStorePort` and `FileSessionStore` with reserved memory/vector sections.
- `ExecutionGraphNode.composer.contextPolicy` already has `reads`, `writes`, `limits`, and `memoryScopes`.
- `contextPolicyForType` in `src/application/execution-controller.ts` already emits memory-related policy values for composer nodes.
- Runtime model calls are orchestrated through `src/domain/recursive-language-model.ts` and application wrappers in `src/application/run-recursive-prompt.ts`, `agent-runner.ts`, and `ui-execution-runner.ts`.
- The existing `RunStateStorePort` and `FileRunStateStore` show the repo pattern for versioned local persistence with mutation audit records.

</code_context>

<specifics>
## Specific Ideas

- Add `src/ports/memory-store-port.ts`, `src/adapters/file-memory-store.ts`, and `src/application/memory-resolver.ts`.
- Use `.rlm/memory/` or `.planning/memory/` for file-backed structured memory; prefer `.rlm/memory/` for runtime-local product state.
- Keep packet text bounded and deterministic. Include a short metadata object for UI/API inspection.
- Introduce runtime event metadata for memory degradation only if it can be done without widening many contracts; otherwise expose through resolver/store inspection APIs in this phase.

</specifics>

<deferred>
## Deferred Ideas

- Preference UI/edit/delete workflows are Phase 27.
- Concrete vector index and embedding retrieval are Phase 28.
- Model-generated rolling summary compression is deferred until there is a clear quality need.

</deferred>
