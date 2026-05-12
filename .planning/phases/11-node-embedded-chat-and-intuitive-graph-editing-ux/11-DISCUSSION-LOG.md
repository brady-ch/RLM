# Phase 11 Discussion Log

**Date:** 2026-05-12  
**Topic:** Typed dataflow node composer and book-scale workflow UX

## Decisions

- Use a ComfyUI-style authoring surface: minimal global chrome, dense always-visible controls inside nodes.
- Treat nodes as typed dataflow modules rather than generic prompt cards.
- Make the prompt one field inside a typed composer, alongside runtime/model selection, ports, context policy, artifact schema, complexity, and budget.
- Support `AI`, `Code`, `TTS`, `Splitter`, `Joiner`, and `Validator` as the MVP node vocabulary.
- Use node-local `Plan` to create editable pending child nodes. Planning does not execute children until explicit approval.
- Add complexity labels so users can identify nodes worth breaking down recursively.
- Add visible plan budgets covering depth and generated-node count. Budget exhaustion pauses expansion and requires explicit approval to extend.
- Store large artifacts such as full book text and generated audio on disk. Pass only artifact refs and metadata through graph state.
- Use manifest + chunk + memory for book-scale workflows so models receive bounded context packets, not the full book.

## Target Scenario

The motivating workflow is full-book audiobook generation:

1. Parse a book into chapter/segment artifacts.
2. Use an AI node to infer speakers and update a persistent speaker bible.
3. Use a TTS node to generate consistent per-character audio clips in bounded chunks.
4. Validate speaker/audio continuity.
5. Use a code-only node to splice ordered audio artifacts into the final audiobook.

## Phase Relationship

Phase 8.5 already established typed artifact contracts, code-only node parity, and run-state continuity. Phase 11 should expose those capabilities in the UI. Phase 10 remains packaging/install UX, but its first-run browser handoff should eventually open onto the Phase 11 typed root composer instead of a passive sample graph.

