# Feature Landscape: Answer Quality Loops

**Domain:** Hybrid draft/critique/refine/gate loops for a recursive language model developer CLI/UI
**Researched:** 2026-05-14
**Scope:** New v1.2 answer-quality loop behavior only. Existing recursive execution, graph approval, node composer, model routing, tool rounds, clarification stops, plugins, and model hosts are treated as available foundations.
**Overall confidence:** MEDIUM-HIGH

## Executive Takeaway

The right product shape is an inspectable evaluator-optimizer loop: one top-level graph node that runs a bounded internal cycle of `Draft -> Critique -> Refine -> Gate`, then selects the best candidate seen so far. Developers should experience it as a predictable workflow node, not as an autonomous agent that keeps inventing work.

The loop should be enabled when quality criteria are explicit or inferable, and when iteration is likely to improve the result: technical explanations, plans, architecture reviews, user-facing writing, structured summaries, and final answer synthesis. It should stay off by default for trivial answers, latency-sensitive CLI use, or tasks where correctness depends on missing external facts.

## Table Stakes

Missing these makes the feature feel unsafe, expensive, or opaque.

| Feature | Expected Behavior | Complexity | Dependencies / Notes |
|---------|-------------------|------------|----------------------|
| Top-level loop node | A hybrid loop appears as one graph node with status, model trail, budget, and approval behavior matching existing nodes. | Medium | Extend `ExecutionGraphNode.kind` or composer type without breaking existing `task/workflow-*` handling. |
| Inspectable internal history | Users can inspect every iteration: draft text, critique findings, refine delta, gate score, unresolved issues, chosen candidate, model per phase, token/model-call usage. | High | Requires new loop metadata outside current flat `TraceEvent.kind`; do not overload graph child nodes unless explicitly expanding internals. |
| Bounded iterations | Loop has hard `maxIterations`, total model-call cap, and optional token/tool budget. Default should be small, likely 2 refinement rounds after the first draft. | Medium | Must integrate with `maxModelCalls`, `ExecutionBudget`, `remainingModelCalls()`, and no-silent-failure policy. |
| Explicit stop reasons | Final metadata must say why it stopped: `pass_threshold`, `critique_resolved`, `no_meaningful_improvement`, `max_iterations`, `budget_exhausted`, `human_accept`, `cancelled`, or `failed`. | Medium | Mirrors current explicit execution statuses; stop reason should be visible in CLI, UI, metadata, and trace. |
| Adaptive rubric selection | Runtime chooses a rubric profile from task/artifact context: general answer quality fallback, code/engineering, planning/architecture, user-facing writing, structured artifact. | High | Needs deterministic rubric IDs and a visible "why this rubric" note. Avoid hidden model-only rubric invention. |
| Rubric criteria are visible | UI/CLI show selected criteria, weights or priority order, pass threshold, and gate policy before/after execution. | Medium | Depends on typed composer/inspector. Editable later, but visible in MVP. |
| Phase-specific model routing | Draft, critique, refine, gate, and best-of-progress can each use configured model purpose routing and optional user override. | High | Current `LanguageModelPurpose` lacks loop-specific purposes. Add typed purposes instead of squeezing all calls through `answer`. |
| Critique as structured feedback | Critique output should include findings with severity, criterion, evidence, actionable recommendation, and resolution status. | High | Structured JSON or typed artifact required; freeform critique is hard to gate or diff. |
| Refine uses critique, not full rewrite by default | Refinement should address open findings and preserve correct parts of the previous candidate. | Medium | Prompt contract should include previous candidate, critique records, original prompt, and rubric. |
| Gate produces structured judgment | Gate outputs pass/fail, score, per-criterion notes, unresolved findings, confidence, and whether another iteration is useful. | High | Must be machine-readable for loop controller decisions; model-graded evals have error rates, so keep rationale visible. |
| Best-of-progress selection | Final answer is chosen from all candidates, not blindly from the last iteration. Selection considers rubric fit, critique resolution, regression risk, and concise user fit. | High | Needs candidate store and comparison prompt; avoids later iterations degrading a good draft. |
| No-regression tracking | Loop flags when refinement made the answer worse, removed needed details, broke structure, or ignored constraints. | Medium | Can start with rubric delta plus gate notes; richer textual diff can come later. |
| Human accept/stop | During approval-capable runs, user can accept current best, stop after current iteration, or reject final candidate. | Medium | Reuse approval/clarification plumbing where possible, but avoid approval prompts after every internal step by default. |
| Failure transparency | Malformed rubric output, parse failures, unavailable selected models, exhausted budgets, and gate ambiguity surface as failed/degraded loop states with actionable messages. | Medium | Align with existing `EXECUTION_FAILURE_CODES`; never silently fall back to a direct answer without metadata. |
| CLI parity | Non-UI runs emit compact loop summary and optional detailed JSON/trace metadata. | Medium | Existing CLI render path must understand loop stop reason and final candidate. |

## Differentiators

These make RLM meaningfully better than a prompt macro or hidden retry loop.

| Feature | Value Proposition | Complexity | Dependencies / Notes |
|---------|-------------------|------------|----------------------|
| Collapsed node with expandable internals | Keeps graph readable while preserving auditability for developers who need to debug quality. | High | Best fit for current graph UX: one node card plus inspector tabs/history. |
| Best-of-progress over last-output | Prevents common self-refine failure where later iterations overfit critique or degrade clarity. | Medium | Requires candidate scoring history and final comparator. |
| Phase model overrides | Developers can use cheaper models for drafting/refining and stronger models for critique/gate, or isolate judge model from generator model. | High | Builds directly on existing per-node model visibility/override and purpose routing. |
| Rubric-fit explanation | Shows why the loop chose code, planning, writing, structured artifact, or general rubric. | Medium | Important because hidden adaptive behavior feels arbitrary. |
| Critique resolution matrix | Inspector shows each critique item as `open/resolved/regressed/waived`, making improvement legible. | High | Enables gate decisions, best-of-progress, and user trust. |
| Meaningful-improvement stop | Loop stops early when candidate score stalls, all high/medium findings are resolved, or refinement keeps making stylistic churn. | High | Needs score deltas plus textual "material change" assessment. |
| Pluggable gate policy | Later structured artifacts can combine LLM judgment with schema validation; code tasks can combine critique with tests. | High | Seed file already points here. Keep answer-quality gate generic but typed. |
| Loop artifact export | Emit a compact `.rlm/runs/<run-id>/loops/<node-id>.json` style artifact for audit, replay, or bug reports while graph stores refs. | Medium | Reuses typed artifact refs and run-state continuity. |
| Mode presets | Presets such as `fast`, `balanced`, `strict`, `writing-polish`, `engineering-review` set iterations, thresholds, models, and rubric strictness. | Medium | Config-driven, but MVP can hardcode `balanced`. |
| A/B draft fanout before loop | Optional best-of-N initial drafts, then refine the strongest one. | High | Expensive; should be a differentiator, not MVP default. |
| Loop-aware graph planning | Planner can recommend adding a loop only for final synthesis, high-risk nodes, or user-facing deliverables. | Medium | Depends on existing graph composer and complexity flags. |

## Anti-Features

These should be explicitly avoided.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Unbounded self-reflection | Cost, latency, and drift can grow without improving answer quality. | Require small iteration caps and explicit stop reasons. |
| Hidden "make it better" retry | Developers cannot debug why output changed or why cost increased. | Store and display draft/critique/refine/gate history. |
| Always-on loop for every node | Wastes model calls on simple subtasks and makes recursive execution slow. | Enable by node type, complexity, final synthesis, or user/config choice. |
| Freeform-only judge output | Hard to parse, compare, or enforce gates. | Use structured gate and critique schemas with parse failure handling. |
| Last iteration always wins | Later iterations can overfit, lose detail, or become more verbose. | Select best-of-progress from all candidates. |
| Single-model self-approval as "truth" | Same-model judges can reinforce blind spots. | Allow separate critique/gate models and expose confidence/uncertainty. |
| Rewriting user intent during refinement | Loop can optimize for its rubric instead of the original prompt. | Always gate against original prompt, constraints, and artifact contract. |
| Treating subjective polish as correctness | A confident judge score may hide missing facts or invalid assumptions. | Separate factual support, instruction adherence, and style criteria. |
| Tool use inside every loop phase | Tool calls multiply cost and risk; most critique/refine/gate steps do not need tools. | Default tools off; allow tools only for evidence/factuality rubrics or configured phases. |
| Storing large payloads in graph state | Existing design keeps large artifacts external; loop history can become large quickly. | Store summaries in graph metadata and full history as artifact refs. |
| User approval after every internal step | Too much friction for a quality loop node. | Provide interrupt/accept current best and optional strict approval mode. |
| Silent direct-answer fallback on gate failure | Violates project requirement for no silent failures. | Return failed/degraded loop with parse/gate reason and best available candidate only if clearly marked. |

## Expected Workflow Shape

```text
Loop Node
  1. Select rubric from prompt + composer/artifact context.
  2. Draft candidate 0.
  3. Critique candidate N against original prompt, context, and rubric.
  4. Gate candidate N with structured score/pass/fail and next-action recommendation.
  5. If pass or resolved or no improvement: stop.
  6. Refine candidate N into candidate N+1 using unresolved critique only.
  7. Repeat until stop.
  8. Best-of-progress chooses final candidate from all candidates.
```

## Feature Dependencies

```text
Loop node type -> execution graph schema/UI card support
Loop phase model routing -> new LanguageModelPurpose values -> config defaults -> model selection trace
Structured critique/gate -> parse/validation layer -> failure codes -> UI/CLI rendering
Best-of-progress -> candidate history store -> rubric scores -> final selection metadata
Human accept -> loop interrupt state -> existing approval/cancel/clarification controller paths
Artifact export -> typed artifact refs -> run-state persistence -> inspector rendering
Adaptive rubric -> rubric registry -> task/artifact classifier -> visible rubric-fit reason
```

## MVP Recommendation

Prioritize:

1. **Single collapsed loop node with internal history**: one graph node, inspector-visible iterations, stop reason, and final candidate.
2. **Balanced adaptive rubric set**: general answer quality plus code/engineering, planning/architecture, writing, and structured-artifact profiles.
3. **Structured critique/gate schemas**: parseable feedback, scores, pass/fail, and unresolved findings.
4. **Best-of-progress final selection**: compare candidates and choose final answer with reason.
5. **Phase-specific model purposes**: support `loop_draft`, `loop_critique`, `loop_refine`, `loop_gate`, `loop_best_of_progress`.

Defer:

| Feature | Reason |
|---------|--------|
| Best-of-N initial draft fanout | Valuable but expensive; best after sequential loop is stable. |
| User-editable custom rubric builder | Requires UX and validation work; start with visible defaults and config-level overrides. |
| Tool-using factuality/research loops | Requires tighter tool policy, source tracking, and hallucination controls. |
| Code-change/test-driven loop controller | Seeded for later; answer-quality loop should prove the primitive first. |
| Full loop replay UI | Useful for debugging but not required for first requirements pass. |

## Complexity Notes by Phase

| Phase Topic | Complexity | Requirement Implications |
|-------------|------------|--------------------------|
| Domain schema | High | Add loop history, candidate, critique, gate, rubric, and stop reason types before runtime work. |
| Runtime controller | High | Loop must reserve model-call budget and stop cleanly without bypassing `maxModelCalls`. |
| Model routing | Medium-High | Purpose-specific routing is straightforward conceptually but touches config, traces, UI labels, and strict selected-model errors. |
| UI inspection | Medium | Existing node inspector can host loop history, but dense iteration data needs tabs/accordion/table treatment. |
| CLI rendering | Medium | Summarize final candidate, stop reason, score, iterations, and "details in trace/artifact" path. |
| Rubric registry | Medium | Defaults can be local TypeScript constants; plugin/declarative rubric contributions can come later. |
| Gate reliability | High | Model graders are useful but imperfect; expose confidence and allow human acceptance/rejection. |
| Persistence/artifacts | Medium | Store compact summaries in metadata and large/full loop records as external refs. |

## Requirement Candidates

| ID | Candidate Requirement |
|----|-----------------------|
| LOOP-HIST | A loop node records append-only iteration history with draft, critique, refine, gate, model, usage, and timestamp data for each phase. |
| LOOP-STOP | A loop node always finishes with one explicit stop reason from an enumerated set. |
| LOOP-RUBRIC | A loop node selects a rubric profile deterministically from task/artifact context and exposes the selected rubric and fit reason. |
| LOOP-SCHEMA | Critique and gate outputs are parsed into typed structures; parse failures surface as visible loop failures or degraded states. |
| LOOP-BOP | Final output is selected from all candidates by a best-of-progress step, not assumed to be the final iteration. |
| LOOP-MODELS | Draft, critique, refine, gate, and best-of-progress phases support distinct model purpose routing and overrides. |
| LOOP-BUDGET | Loop execution is bounded by max iterations and model-call budget, with preflight estimate and runtime budget updates. |
| LOOP-HUMAN | Users can accept current best or stop the loop without losing recorded history. |

## Sources

- Project context: `.planning/PROJECT.md`, `.planning/REQUIREMENTS.md`, `.planning/seeds/loop-controller-structured-artifacts-and-implementation.md` (HIGH confidence for local requirements).
- Code context: `src/domain/recursive-language-model.ts`, `src/domain/types.ts`, `ui/src/main.tsx` (HIGH confidence for existing graph/runtime/UI dependencies).
- Anthropic, "Building Effective AI Agents" (official, current page opened 2026-05-14): evaluator-optimizer loops are a common workflow where one LLM generates and another evaluates in a loop; use them when evaluation criteria are clear and iteration has measurable value. https://www.anthropic.com/engineering/building-effective-agents (MEDIUM-HIGH confidence).
- Anthropic prompt engineering docs, "Chain complex prompts" (official docs opened 2026-05-14): explicit chains remain useful when intermediate outputs need inspection or fixed pipeline structure. https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices#chain-complex-prompts (MEDIUM-HIGH confidence).
- OpenAI Cookbook, "Getting Started with OpenAI Evals" (official cookbook opened 2026-05-14): evals can use deterministic checks or model graders; model graders are useful for open-ended outputs but have error rates and should be validated with human evaluation. https://developers.openai.com/cookbook/examples/evaluation/getting_started_with_openai_evals (MEDIUM confidence; cookbook notes newer hosted evals exist).
- Madaan et al., "Self-Refine: Iterative Refinement with Self-Feedback" (arXiv, 2023): iterative feedback/refinement can improve outputs at test time without training. https://arxiv.org/abs/2303.17651 (MEDIUM confidence for pattern, not product requirements).
- Shinn et al., "Reflexion: Language Agents with Verbal Reinforcement Learning" (arXiv, 2023): verbal feedback memory improves agent trials and supports multiple feedback signal types. https://arxiv.org/abs/2303.11366 (MEDIUM confidence for feedback-loop rationale, not direct UI behavior).
