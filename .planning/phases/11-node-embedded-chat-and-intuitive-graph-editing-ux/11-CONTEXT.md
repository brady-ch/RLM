# Phase 11: Node-Embedded Chat and Intuitive Graph Editing UX - Context

**Gathered:** 2026-05-12  
**Status:** Ready for planning  

<domain>
## Phase Boundary

Deliver a minimal-chrome, dense-node workflow authoring UI inspired by ComfyUI. The canvas should support typed dataflow nodes, node-local composition, bounded recursive planning, artifact-aware ports, code-only nodes, direct graph editing, and book-scale workflows that avoid model context overflow.

This phase covers:
- Typed node composer UI for model, TTS, code-only, splitter, joiner, validator, and future plugin nodes.
- Node-local prompt/code/config authoring inside the graph.
- Plan mode that expands a node into editable pending child nodes.
- Complexity rating and explicit break-down controls per node.
- Visible plan budgets that constrain recursive expansion.
- Dataflow ports that pass typed artifact refs and metadata, not large payloads.
- Direct graph controls: drag, connect, plan/spawn, break down, delete, approve.
- First-run handoff from Phase 10 into an editable root node rather than a passive sample graph.

Out of scope here:
- Reworking packaging mechanics already completed in Phase 10.
- Re-implementing typed artifact validation/runtime persistence already completed in Phase 8.5, except where UI/API exposure is needed.
- Full remote object storage implementation; local disk artifact refs are the MVP storage target.

</domain>

<decisions>
## Implementation Decisions

### Composer model
- **D-11-01:** Use a ComfyUI-style graph canvas: minimal app chrome, dense always-visible controls inside each node.
- **D-11-02:** Nodes are typed modules, not generic prompt cards. The prompt is one field inside a typed node composer.
- **D-11-03:** MVP node types are `AI`, `Code`, `TTS`, `Splitter`, `Joiner`, and `Validator`.
- **D-11-04:** Each node exposes typed input/output ports with artifact schema summaries and validation state.
- **D-11-05:** Code-only nodes are first-class composer nodes with script/function selection, sandbox policy display, input artifact refs, and output schema.

### Recursive planning UX
- **D-11-06:** `Plan` on a node creates editable pending child nodes and does not execute them.
- **D-11-07:** Planner output includes per-node complexity (`low`/`medium`/`high`) and a recommended next action.
- **D-11-08:** High-complexity nodes expose an explicit `Break down` action that applies the same plan workflow recursively.
- **D-11-09:** Recursive planning is constrained by visible budgets: max depth, max nodes, and approval-required policy.
- **D-11-10:** Budget exhaustion pauses expansion with a visible `Needs approval to expand` state and an explicit `Extend budget` action.

### Large artifact and context strategy
- **D-11-11:** Large artifacts such as audio clips and full book text are stored on disk under the run workspace, with graph state passing only artifact refs and metadata.
- **D-11-12:** Artifact metadata should include id, path/URI, media type, hash, duration/size where relevant, producer node, ordering key, and domain metadata such as speaker/chapter/segment ids.
- **D-11-13:** Book-scale workflows use manifest + chunk + memory: stable segment manifests, per-node context packets, speaker bible, rolling summaries, and checkpointed run state.
- **D-11-14:** Each node composer exposes a `Context Policy` summary: reads, writes, token/window limits, batching limits, and allowed memory scopes.

### Phase 10 relationship
- **D-11-15:** Phase 10 remains the packaging/install phase. Its first-run UI should be amended after Phase 11 so the default browser experience opens on an editable typed root node composer.

</decisions>

<canonical_refs>
## Canonical References

Downstream agents MUST read:
- `.planning/ROADMAP.md` — Phase 11 goal and success criteria.
- `.planning/REQUIREMENTS.md` — `UXND-01` through `UXND-04`.
- `.planning/phases/08.5-typed-artifact-stateful-workflow-runtime/08.5-CONTEXT.md` — typed artifacts, code-only lifecycle, run-state continuity.
- `.planning/phases/09-chat-first-graph-ux-and-clarification-stops/09-CONTEXT.md` — chat-first authoring and clarification stop semantics.
- `.planning/phases/10-cross-platform-executable-packaging-and-install-ux/10-UI-SPEC.md` — first-run browser handoff constraints.
- `src/application/control-server.ts` — UI/control-plane API surface.
- `src/domain/types.ts` — graph, artifact, and runtime event types.
- `ui/src/main.tsx` and related UI graph components — browser implementation entry.

</canonical_refs>

<example_workflow>
## Target Workflow: Full-Book Audiobook Generation

1. `Book Parser` code-only node ingests EPUB/PDF/TXT from disk and emits chapter/segment artifact refs plus a manifest.
2. `Speaker Interpreter` AI node receives one segment context packet at a time and updates speaker attribution plus a persistent speaker bible.
3. `TTS Batch` node receives text segments and speaker voice metadata, then emits audio clip artifact refs to disk to avoid TTS duration and memory limits.
4. `Consistency Check` AI or code node validates speaker continuity and flags mismatches.
5. `Audio Splicer` code-only node reads ordered audio refs and produces the final audiobook artifact.

The UI must make clear that the model context contains only the current segment, relevant summaries, and speaker memory entries, while full text/audio payloads remain as artifacts outside prompt context.

</example_workflow>

<deferred>
## Deferred Ideas

- Remote/object-store artifact backend.
- Visual waveform editing.
- Advanced node library marketplace.
- Multi-user collaborative graph editing.

</deferred>

