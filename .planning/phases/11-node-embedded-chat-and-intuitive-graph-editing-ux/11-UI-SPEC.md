# Phase 11 — UI Design Contract (Typed Dataflow Node Composer)

**Phase:** Node-Embedded Chat and Intuitive Graph Editing UX  
**Status:** Planning input — visual/interaction contract

## Visual Direction

Use a ComfyUI-style graph tool:
- Minimal global chrome: graph canvas, compact toolbar, node palette, run/status strip.
- Dense nodes with always-visible controls.
- Typed dataflow ports for inputs and outputs.
- Clear runtime state colors and labels, without relying on color alone.

## Node Composer Anatomy

Every editable node should expose:
- Header: node title, node type, status, complexity.
- Runtime: model/runtime selector (`AI`, `Code`, `TTS`, etc.).
- Body: prompt editor, code selector/editor, or type-specific configuration.
- Ports: typed input/output ports with artifact/schema labels.
- Context Policy: reads, writes, limits, memory scopes, batching/chunking policy.
- Planning controls: `Plan`, `Break down`, budget display.
- Execution controls: `Approve`, `Run`, `Pause`/`Resume` where applicable.
- Safety controls: delete with dependency validation and explicit error recovery.

## Plan Mode

When a user clicks `Plan` on a node:
1. Runtime asks the planner to produce an editable child graph.
2. Children appear in `pending` state.
3. Each child has a type, ports, summary, complexity rating, and budget impact.
4. No child executes until the user approves.
5. High-complexity children expose `Break down`, which recursively applies the same behavior.

## Budget UX

Show planning limits on the node or run strip:
- Remaining depth.
- Remaining generated-node count.
- Approval policy.

If expansion exceeds budget:
- Stop expansion.
- Mark the node `Needs approval to expand`.
- Show a single explicit `Extend budget` action.
- Record the decision in run history.

## Artifact UX

Large payloads are never embedded in graph state.

Nodes display artifact refs and previews:
- Book/chapter/segment refs.
- Audio clip refs with duration/sample rate/voice metadata.
- Manifest refs with ordered segment ids.
- Hash/status/producer node.

Preview actions may open or stream artifacts, but the graph state passes metadata and refs only.

## Book-Scale Context UX

Composer should make context boundaries visible:
- Current segment or batch.
- Relevant rolling summary.
- Speaker bible entries available to the node.
- Max context/window size.
- Memory writes the node is allowed to perform.

The author should be able to tell, from the node, why the workflow can process a full book without loading the full book into model context.

## First-Run Handoff

After Phase 11, the packaged UI should open with:
- One editable typed root node.
- A prompt area ready for the user’s first task.
- Default Plan Budget visible.
- Empty graph canvas ready to expand after `Plan`.

This supersedes a passive sample graph as the primary first-run experience.

