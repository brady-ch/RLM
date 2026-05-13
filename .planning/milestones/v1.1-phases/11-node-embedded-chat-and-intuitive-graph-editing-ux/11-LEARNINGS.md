---
phase: 11
phase_name: "node-embedded-chat-and-intuitive-graph-editing-ux"
project: "Recursive Language Model CLI"
generated: "2026-05-13T00:34:01-06:00"
counts:
  decisions: 5
  lessons: 5
  patterns: 5
  surprises: 4
missing_artifacts:
  - "*-UAT.md"
---

# Phase 11 Learnings: node-embedded-chat-and-intuitive-graph-editing-ux

## Decisions

### Typed Dataflow Composer Contract
Nodes are represented as typed dataflow modules with node type, runtime/model selection, prompt or code configuration, typed ports, artifact schema summaries, complexity, budget, and artifact refs.

**Rationale:** The phase goal required nodes to stop behaving like generic prompt cards and instead support modular long-running workflows with explicit dataflow semantics.
**Source:** 11-01-PLAN.md

---

### Plan Mode Requires Explicit Approval
Node-local planning creates editable pending child graph state and does not execute planned children until the user explicitly approves execution.

**Rationale:** The phase must preserve the no-silent-execution guarantee while allowing recursive graph expansion through the UI.
**Source:** 11-01-PLAN.md

---

### Shared Root Budget For Recursive Planning
Recursive planning consumes a shared root budget across branches rather than copying independent budgets into each child branch.

**Rationale:** Shared budget accounting prevents runaway expansion and makes visible depth/node limits meaningful across the whole planned graph.
**Source:** 11-01-SUMMARY.md

---

### Artifact Refs Instead Of Large Payloads
Large workflow artifacts are surfaced through refs and metadata in graph state, with large payload storage represented as disk refs and future object storage left deferred.

**Rationale:** Full-book and audio workflows need graph inspection without loading book chunks or audio payloads into model context or UI state.
**Source:** 11-01-SUMMARY.md

---

### Deterministic MVP Planner
The vertical slice uses deterministic node-local planning for audiobook-style graph shapes, while preserving the UI/API contract for future model-backed planning.

**Rationale:** Deterministic planning was sufficient to prove the composer, pending graph, budget, artifact, and control contracts before replacing the planner with model-driven decomposition.
**Source:** 11-01-SUMMARY.md

---

## Lessons

### Composer Launch Must Not Start Execution
Opening the UI composer must seed an editable authoring session instead of launching model execution immediately.

**Context:** Review fixes explicitly stopped UI mode from launching runtime execution on composer open.
**Source:** 11-01-SUMMARY.md

---

### Graph Reparenting Needs Topology Safety
Direct graph editing needs cycle rejection and stale incoming-edge cleanup when nodes are reparented.

**Context:** Review fixes added cycle rejection and stale-edge cleanup, and verification cites regression coverage for graph topology safety.
**Source:** 11-VERIFICATION.md

---

### Budget Extension Needs Server And UI Gating
The Extend budget action must be allowed only when a budget is exhausted, and that rule has to exist in endpoint behavior as well as the UI.

**Context:** Review fixes gated budget extension to exhausted states and added endpoint coverage.
**Source:** 11-VERIFICATION.md

---

### Manual UI Feel Remains A Separate Check
Automated verification can pass the MVP contract, but final interaction feel still benefits from a manual UI walkthrough.

**Context:** Verification passed with no blocking human-only items, while still recommending a manual UI walkthrough for interaction feel.
**Source:** 11-VERIFICATION.md

---

### Code-Only Nodes Need First-Class Composer Treatment
Code-only nodes need their own runtime, script entry, sandbox policy, artifact-ref ports, and child-generation behavior rather than being modeled as prompts.

**Context:** Verification treats Code composer nodes as first-class and checks code runtime and artifact-ref port behavior.
**Source:** 11-VERIFICATION.md

---

## Patterns

### Typed Graph State Contract
Expose rich composer metadata through the control-server graph state and render it directly in the UI.

**When to use:** Use this when a feature needs the UI, API, and runtime to agree on node semantics without embedding large payloads in graph state.
**Source:** 11-01-PLAN.md

---

### Pending Child Graph Preview
Use node-local Plan actions to generate editable planned children with type, summary, ports, complexity, and budget impact while keeping graph readiness in draft.

**When to use:** Use this for recursive planning UX where users must inspect and edit decomposition before execution starts.
**Source:** 11-01-PLAN.md

---

### Visible Budget Exhaustion Pause
Represent remaining plan depth/node limits in node state, mark exhausted budgets visibly, and require an explicit Extend budget action before further expansion.

**When to use:** Use this for recursive or branching workflows where bounded expansion is a safety requirement.
**Source:** 11-VERIFICATION.md

---

### Artifact Ref Display
Render artifact refs, schema summaries, and context policy metadata in node cards instead of exposing large content inline.

**When to use:** Use this for book-scale, audio, generated-file, or other large-artifact workflows where model context and UI state must stay small.
**Source:** 11-01-SUMMARY.md

---

### Regression Tests For Control Semantics
Cover composer state, pending plan graph creation, shared budget consumption, topology safety, and endpoint budget behavior with regression tests.

**When to use:** Use this when UI-visible graph controls are backed by server-side state transitions that could silently regress.
**Source:** 11-VERIFICATION.md

---

## Surprises

### UI Session Initially Executed Too Early
The composer launch path initially started runtime execution immediately instead of opening a draft authoring surface.

**Impact:** This violated the intended plan-before-execute workflow and required a review fix before verification passed.
**Source:** 11-01-SUMMARY.md

---

### Per-Child Budget Copies Were Unsafe
Recursive planning initially copied budgets per child branch instead of consuming a shared root budget.

**Impact:** The budget model could allow more expansion than the visible root budget implied, so shared budget accounting had to be added.
**Source:** 11-01-SUMMARY.md

---

### Graph Editing Needed Explicit Cycle And Stale-Edge Handling
Reparenting behavior needed explicit cycle rejection and stale incoming-edge cleanup.

**Impact:** Direct graph manipulation required additional topology safeguards to keep graph state coherent.
**Source:** 11-VERIFICATION.md

---

### UAT Artifact Was Not Present
The phase had PLAN, SUMMARY, VERIFICATION, and STATE artifacts, but no `*-UAT.md` artifact was available for extraction.

**Impact:** Learnings could not include user acceptance test feedback beyond the verification note that a manual UI walkthrough remains recommended.
**Source:** 11-VERIFICATION.md
