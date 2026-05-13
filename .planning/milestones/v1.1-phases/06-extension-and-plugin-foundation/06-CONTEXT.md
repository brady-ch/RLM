# Phase 6: Extension and Plugin Foundation - Context

**Gathered:** 2026-05-09
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver a **documented, working extension interface** so tools, skill loaders, and model host adapters can register **without editing core sources** (PLUG-01). This phase establishes discovery, trust, API shape, and migration of **built-in** tools onto the same path as **third-party** extensions. MCP wiring, remote hosts, and chat UX are **out of scope** here (Phases 7–9).

</domain>

<decisions>
## Implementation Decisions

### Discovery and configuration surface
- **D-01:** **YAML-first:** User-facing enablement and extension references live in `rlm.config.yaml` (or the project’s established config file), not only in ad-hoc TypeScript.
- **D-02:** **Folder layout:** First-party / built-in extension modules are **shipped inside the CLI package** under a stable, documented directory (exact dirname TBD in plan—e.g. packaged `extensions/` or `dist/extensions/`). **User and third-party** extensions default to a **project-local** directory (e.g. `./extensions/` next to the config or workspace root), also documented. YAML entries resolve to paths under these documented roots.
- **D-03:** The **executable story** stays “run the CLI”: the same entrypoint reads YAML, resolves extension paths, and loads modules; no separate manual `node register.js` step for normal use.

### Trust and safety
- **D-04:** **First-load explicit confirmation:** The first time an extension identity (path / package key) is seen, the runtime **must** surface an explicit user-facing approval step before executing its code; approved identities are **persisted** (allowlist / store on disk) so later runs do not silently load new code. Revocation/editing of that store is in scope for planning (exact UX: CLI first; UI may follow in later phases).

### Extension API taxonomy
- **D-05:** **Parallel registries** behind a single facade: expose separate registration surfaces for **tools**, **skill loaders**, and **model host adapters** (e.g. an `ExtensionHost`-style type) rather than collapsing everything into one union-only registry. Shared lifecycle hooks (init order, errors) live on the facade.

### Migration of built-ins
- **D-06:** **First-party bundled extensions:** Today’s built-in tools (shell, file write, web search, web fetch, etc.) move into **first-party extension packages** colocated with the shipped extension directory, registered through the **same loader and contracts** as third-party extensions. `src/index.ts` (composition root) reduces to orchestration: load config → run extension loader → wire agent registry from the populated registries—**no permanent special-case** “built-ins only in index.ts” once migration is complete.

### Claude's discretion
- Exact **relative-path resolution order** (strictly config-directory–anchored vs cwd-first): choose the safer default in plan/research (likely config-dir–anchored with explicit override flag if needed).
- Exact **on-disk store format** for the post-confirmation allowlist (JSON vs YAML fragment): implementation detail for plan phase.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements and roadmap
- `.planning/REQUIREMENTS.md` — PLUG-01 (v1.1 extensibility); v1 requirements for regression context
- `.planning/ROADMAP.md` — Phase 6 goal, success criteria, dependency on Phase 5
- `.planning/PROJECT.md` — Milestone v1.1 intent and core value

### Research (adjacent phases; do not implement Phase 8 in Phase 6)
- `.planning/research/TOOL-CALLING-CONSTRAINED-DECODING.md` — Constrained tool calling background for HOST/TCON phases; informs why extension surface must not block host-specific envelopes

### Architecture maps
- `.planning/codebase/ARCHITECTURE.md` — Ports/adapters split, composition-root tension in `src/index.ts`
- `.planning/codebase/STACK.md` — Runtime and module conventions
- `.planning/codebase/CONVENTIONS.md` — Repo conventions for new modules

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable assets
- `src/ports/tool-port.ts` — Stable tool contract; extensions register `ToolPort` implementations
- `src/index.ts` — Today’s `toolsByName` `Map` and `toolsFor(agentId)` wiring; migration target shrinks this block

### Established patterns
- Config-driven agents and tool allowlists per agent in YAML (`project-config` / `agent-registry`)

### Integration points
- Composition root after `loadProjectConfig` / `resolveRuntimeConfig`; agent registry construction; future skill/MCP attachment points at application boundary (not domain policy internals)

</code_context>

<specifics>
## Specific Ideas

- User wants configuration **fully driven from YAML** visible to operators, with extensions living in a **known folder** alongside packaged first-party extensions when the product is built/shipped, while keeping a single **CLI executable** workflow.

</specifics>

<deferred>
## Deferred Ideas

- MCP server wiring, skill disk layouts, remote model hosts, constrained decoding integration — Phases 7–9 per ROADMAP
- UI-specific approval UX for new extensions (may extend D-04 later); Phase 6 should still specify CLI behavior clearly

**None — discussion stayed within phase scope** for reviewed todos (no todo matches run).

</deferred>

---

*Phase: 6-Extension and Plugin Foundation*
*Context gathered: 2026-05-09*
