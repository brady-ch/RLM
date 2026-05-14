# Project Research Summary

**Project:** Recursive Language Model CLI v1.2
**Domain:** Answer Quality Loops for recursive developer workflows
**Researched:** 2026-05-14
**Confidence:** MEDIUM-HIGH

## Executive Summary

v1.2 should add answer-quality loops as a bounded evaluator-optimizer capability inside the existing recursive CLI/UI runtime. Experts build this pattern as an inspectable `draft -> critique -> refine -> gate` loop with clear criteria, hard iteration limits, separate generator/judge routing when useful, and a final best-of-progress selection instead of blindly accepting the last rewrite.

The recommended approach is first-party TypeScript integration, not a new orchestration framework. A quality loop should appear as one top-level execution graph node with typed internal history, phase-level model metadata, selected rubric, scores, stop reason, and final candidate. The existing recursive engine, purpose routing, graph controller, run-state persistence, SSE snapshots, ReactFlow UI, and artifact-ref pattern are sufficient foundations.

The main risks are hidden cost, opaque judge behavior, evaluator self-reinforcement, and UI state confusion. Mitigate them with explicit loop budgets, structured critique/gate schemas, visible rubric choice, phase-specific model overrides, best-of-progress selection, strict parse/error handling, and deterministic fixtures for regression coverage.

## Key Findings

### Stack Additions

Do not replace the stack. Add focused domain/application modules and extend existing contracts.

- `src/domain/quality-loop.ts` or `refinement-loop.ts`: bounded loop execution helpers, stop-reason logic, candidate comparison.
- `src/domain/quality-rubrics.ts`: adaptive rubric registry for general, code/engineering, planning/architecture, writing, and structured artifacts.
- `src/domain/quality-gate-parser.ts`: Zod-backed parsing/validation for critique, gate, and best-of-progress outputs.
- `LanguageModelPurpose`: add `draft`, `critique`, `refine`, `gate`, and `best_of_progress`.
- `ExecutionGraphNode`: add `qualityLoop` metadata while keeping one top-level graph node.
- `ExecutionEvent`: add loop phase updates with iteration, score, status, and stop reason.
- `RunStatePersistence`: persist compact loop summaries and use artifact refs for large candidate histories.
- UI: add a loop-aware node card summary and inspector timeline in the existing React/Vite/ReactFlow surface.

Keep using TypeScript, Zod, React/Vite, `@xyflow/react`, `lucide-react`, and the current purpose-routing model provider. Do not add LangGraph, Redux/Zustand/XState, SQLite/Postgres, vector databases, or external evaluator services for v1.2.

### Feature Table Stakes

- One collapsed top-level loop node with status, model trail, budget, and approval behavior matching existing nodes.
- Inspectable internal history for drafts, critiques, refinements, gate results, scores, unresolved issues, selected candidate, model per phase, and usage.
- Hard bounds via `maxIterations`, existing `maxModelCalls`, optional loop-call budget, and visible budget accounting.
- Explicit terminal stop reasons: `pass_threshold`, `critique_resolved`, `no_meaningful_improvement`, `max_iterations`, `budget_exhausted`, `human_accept`, `cancelled`, or `error`.
- Adaptive but visible rubric selection with deterministic rubric IDs and fit reasons.
- Structured critique and gate outputs, with parse failures surfaced as visible failed/degraded loop states.
- Best-of-progress final selection from all candidates, not latest-output wins.
- Phase-specific model routing and overrides for draft, critique, refine, gate, and best-of-progress.
- CLI parity: compact text summary plus JSON/trace metadata for stop reason, score, iterations, and final candidate.

Differentiators worth prioritizing after the table stakes are critique-resolution matrices, meaningful-improvement early stop, phase model override controls, rubric-fit explanation, and loop artifact export. Defer best-of-N fanout, custom rubric builder, tool-using factuality loops, code/test-driven loop controllers, and full replay UI until the core loop is reliable.

### Architecture Direction

Implement loops as a solver strategy inside `RecursiveLanguageModel`, not as a separate workflow runner and not as multiple top-level graph nodes. The recursive planner still decides task structure; the quality loop improves one candidate answer for a task or synthesis node.

Major components:

1. `RecursiveLanguageModel` owns model calls, budget checks, cancellation, trace updates, graph mutation, and delegation to loop helpers.
2. `quality-loop.ts` computes loop progression, stop reasons, best candidate choice, and near-pure policy decisions.
3. `quality-rubrics.ts` selects deterministic rubrics and renders compact criteria/prompts.
4. `quality-gate-parser.ts` validates structured model outputs with Zod and returns explicit parse errors.
5. `PurposeRoutingLanguageModel` remains the central routing point once new purposes are added.
6. `ExecutionController` remains backend-authoritative for graph snapshots, loop metadata, phase overrides, and human accept state.
7. `control-server.ts` exposes phase override and accept endpoints.
8. `ui/src/main.tsx` renders compact node status plus expandable loop inspector detail.
9. `cli/render.ts` reports loop status, score, stop reason, and trace/artifact references.

## Watch-Outs

1. **Unbounded loops can consume model budget**: make `maxIterations`, loop call accounting, and `budget_exhausted` first-class; test low-budget runs.
2. **Opaque internals destroy trust**: store typed loop history under the node and emit phase events with iteration, model, score, selected candidate, and stop reason.
3. **Evaluator self-reinforcement can reward worse answers**: separate judge/generator models where useful, keep criteria concrete, control verbosity, and add calibration fixtures.
4. **Rubric selection can be silently wrong**: store `rubricId`, criteria, task-classification reason, and explicit fallback reason.
5. **Freeform critique/gate output is brittle**: require structured schemas, reject vague critique, and surface parse failures.
6. **Best-of-progress can regress if latest wins**: keep all candidates and choose by pass threshold, higher score, fewer unresolved critical issues, then earlier candidate.
7. **Model override semantics can become misleading**: expose planned/effective model per phase and enforce strict selected-model errors for explicit phase overrides.
8. **Human approval and quality gates can be conflated**: keep outer graph approval separate from optional loop accept/retry controls.
9. **Large traces can slow UI**: store compact summaries in graph metadata and full candidate bodies as artifact refs when needed.
10. **Prompt edits can stale loop history**: invalidate loop history when prompt, model, or rubric inputs change.

## Roadmap Implications

### Phase 1: Loop Runtime Contract

**Rationale:** Everything else depends on stable types, budgets, stop reasons, and graph/event metadata.
**Delivers:** Loop config, phase types, `qualityLoop` node metadata, event schema, stop reason enum, budget accounting, config defaults.
**Addresses:** Top-level loop node, bounded iterations, explicit stop reasons, visible loop state.
**Avoids:** Unbounded budget use, invisible internals, conflated stop/failure states, broken model metadata.
**Research flag:** Skip deeper research; patterns are local and well documented by repo code.

### Phase 2: Rubric and Evaluator Contract

**Rationale:** The loop needs concrete criteria and parseable judge output before runtime refinement can be trusted.
**Delivers:** Rubric registry, adaptive rubric selection, structured critique schema, structured gate schema, parser failures, evaluator prompt-injection fixtures.
**Addresses:** Adaptive rubrics, visible criteria, structured critique/gate, rubric-fit explanation.
**Avoids:** Generic/wrong rubrics, vague critique, freeform judge parsing, evaluator prompt injection.
**Research flag:** Needs focused research if rubric scoring semantics or model-grader calibration become product-critical.

### Phase 3: Refine and Best-of-Progress Engine

**Rationale:** Runtime looping should come after contracts and evaluator schemas are stable.
**Delivers:** Bounded `draft/critique/refine/gate` loop, improvement-delta stop, candidate history, best-of-progress selection, degraded completion when usable partial work exists.
**Addresses:** Refine uses critique, best-of-progress, no-regression tracking, meaningful-improvement stop.
**Avoids:** Latest-output wins, loop failures erasing usable work, false precision in scores.
**Research flag:** Standard implementation patterns; validate with fixtures rather than more research.

### Phase 4: Model Routing, Visibility, and Overrides

**Rationale:** Phase-specific model control crosses config, model provider, trace, controller, API, and UI, so it should land after runtime phases exist.
**Delivers:** New purpose routing, phase override precedence, planned/effective phase model trail, phase model API endpoint, UI controls.
**Addresses:** Phase-specific model routing and override differentiator.
**Avoids:** Hidden models, accidental judge/draft override coupling, swallowed selected-model errors.
**Research flag:** Skip deeper research; this is mostly existing architecture extension.

### Phase 5: Inspectable UI, CLI, and Human Gate Hardening

**Rationale:** UI/CLI should consume stable metadata rather than drive the contract. Human accept is safer after automatic loops are reliable.
**Delivers:** Node card status, inspector timeline, critique resolution display, CLI loop summary, optional human accept/stop endpoint and state.
**Addresses:** Collapsed node with expandable internals, CLI parity, human accept/stop.
**Avoids:** Graph layout pollution, approval/gate confusion, trace volume problems.
**Research flag:** Needs UI/UX validation, not broad technical research.

### Phase 6: Quality Verification and Regression Harness

**Rationale:** Judge behavior and loop policy are easy to regress without deterministic fixtures.
**Delivers:** Fake-model loop tests, golden traces, budget exhaustion tests, parser failure tests, prompt-injection fixtures, calibration fixtures, UAT scenarios for pause/cancel/approval interactions.
**Addresses:** Reliability across runtime, evaluator, UI, and CLI.
**Avoids:** Flaky live-model tests, judge reward hacking, recursion/loop budget explosion.
**Research flag:** Needs targeted eval-design research only if live model judge calibration becomes part of acceptance.

### Phase Ordering Rationale

- Contracts and metadata must precede UI so the inspector renders stable state.
- Rubrics and structured evaluator outputs must precede refinement so the loop has machine-readable decisions.
- Runtime should prove automatic bounded behavior before adding human gate complexity.
- Model overrides can reuse existing purpose-routing infrastructure once loop phases are first-class.
- Verification should start early with fake models, but the dedicated hardening phase should close the milestone.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Strong local evidence that existing TypeScript/domain/application/UI architecture already has the needed primitives. |
| Features | MEDIUM-HIGH | Table stakes align across local requirements and external evaluator-optimizer guidance; exact UX density needs validation. |
| Architecture | HIGH | Integration points are grounded in repository modules and current graph/controller/model-routing boundaries. |
| Pitfalls | MEDIUM-HIGH | Local integration risks are high-confidence; evaluator-quality risks are supported by external guidance but need calibration fixtures. |

**Overall confidence:** MEDIUM-HIGH

### Gaps to Address

- **Rubric thresholds:** Define coarse pass bands and minimum meaningful delta during planning; avoid pretending score decimals are precise.
- **Loop enablement policy:** Decide whether v1.2 loops are opt-in, composer-recommended, or enabled for final synthesis/high-risk nodes only.
- **Human gate scope:** Decide whether `human_accept` is MVP or follows after automatic loop reliability.
- **Artifact storage threshold:** Define when candidate bodies move from graph metadata to artifact refs.
- **Structured artifact validation:** If structured outputs are in scope, validate every candidate before scoring.
- **Judge calibration:** Add deterministic fake-model tests first; use live-model smoke tests only as supplementary checks.

## Sources

### Primary

- `.planning/research/STACK.md` — stack additions, model routing, integration points.
- `.planning/research/FEATURES.md` — table stakes, differentiators, anti-features, MVP recommendation.
- `.planning/research/ARCHITECTURE.md` — component boundaries, data flow, build order.
- `.planning/research/PITFALLS.md` — critical/moderate risks and acceptance hooks.
- `.planning/PROJECT.md` and `.planning/REQUIREMENTS.md` — milestone context and existing constraints.
- Repository modules: `src/domain/recursive-language-model.ts`, `src/domain/types.ts`, `src/application/execution-controller.ts`, `src/application/model-provider.ts`, `src/application/project-config.ts`, `src/application/control-server.ts`, `ui/src/main.tsx`.

### Secondary

- Anthropic, "Building Effective AI Agents" — evaluator-optimizer loop guidance.
- Anthropic prompt engineering docs — value of explicit chains with inspectable intermediate outputs.
- Anthropic, "Demystifying evals for AI agents" — eval structure and multi-turn risk.
- OpenAI evaluation and grader guidance — grader reliability, calibration, and reward-hacking concerns.
- AWS Prescriptive Guidance, evaluator reflect-refine loop patterns — generator/evaluator/refiner stop patterns.
- Madaan et al., "Self-Refine" — iterative feedback/refinement rationale.
- Shinn et al., "Reflexion" — verbal feedback loop rationale.
- Dietz et al., "Principles and Guidelines for the Use of LLM Judges" — circularity and self-reinforcement risks.

---
*Research completed: 2026-05-14*
*Ready for roadmap: yes*
