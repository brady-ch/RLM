# Domain Pitfalls: Answer Quality Loops

**Domain:** Hybrid LLM evaluator/refinement loops in an existing recursive workflow engine  
**Researched:** 2026-05-14  
**Confidence:** MEDIUM-HIGH. Project integration risks are HIGH from local code inspection; evaluator-quality risks are MEDIUM-HIGH from OpenAI, Anthropic, AWS, and recent LLM-judge guidance.

## Recommended Phase Placement

Use these phase labels when building the v1.2 roadmap:

1. **Loop Runtime Contract** - Add loop node types, internal step schema, budgets, stop reasons, and trace/event metadata.
2. **Rubric and Evaluator Contract** - Add adaptive rubric selection, structured critique output, scoring semantics, and evaluator model routing.
3. **Refine and Best-of-Progress Engine** - Add bounded draft/critique/refine/gate iterations and final candidate selection.
4. **Inspectable UI and Overrides** - Show loop internals, per-step model trail, stop reason, scores, critiques, and human accept controls.
5. **Quality Verification and Regression Harness** - Add deterministic fixtures, judge-calibration tests, budget/error regression tests, and UAT scenarios.

## Critical Risks

| Pitfall | Warning Signs | Prevention Strategy | Phase |
|---|---|---|---|
| Unbounded refinement loops consume all model budget | `modelCallsRemaining` unexpectedly hits zero; loop runs until generic model-call failure; final answer is fallback text; CLI/UI shows failed node without loop stop reason | Make loop budget first-class: `maxIterations`, `maxLoopModelCalls`, per-step call accounting, and terminal stop reasons. Reserve a final-answer call before entering a loop, just as recursive solving currently reserves direct-answer budget. Test with low `maxModelCalls` and assert graceful `max_iterations` or `budget_exhausted` stop. | 1 |
| Loop internals become invisible inside one graph node | Top-level node says completed but user cannot inspect drafts, critiques, gate decisions, selected candidate, or failed iteration; trace only has generic `answer`/`synthesize` events | Represent loop history as structured metadata under the node, not as opaque text. Emit events for `draft`, `critique`, `refine`, `gate`, and `best_of_progress` with iteration numbers, scores, stop reason, and selected candidate id. Keep large candidate payloads as artifact refs if needed. | 1, 4 |
| Evaluator self-reinforcement rewards answers that satisfy the judge but not the user | Scores improve while human review says answer got worse; verbose answers win; evaluator repeats rubric words from the candidate; best-of-progress always picks the latest answer | Separate optimizer and judge prompts/models where possible. Prefer pairwise or pass/fail checks for final gates, control response length, and keep rubric criteria concrete. Add calibration fixtures with known better/worse candidates and verify judge ranking matches expected ordering. | 2, 5 |
| Rubric selection is too generic or silently wrong | Code tasks judged only on tone; structured artifacts judged without schema checks; planning answers judged without dependency/risk criteria; no indication of selected rubric | Store `rubricId`, criteria, task-classification reason, and fallback reason in metadata. Make rubric fallback explicit, not silent. Require domain rubrics for code, planning/architecture, user-facing writing, and structured artifacts before enabling adaptive selection by default. | 2 |
| Critique is not actionable enough to drive refinement | Refiner repeats the same answer; critique says "improve clarity" without concrete deltas; no meaningful score movement across iterations | Require critique output to include failed criteria, evidence from candidate text, concrete revision instructions, and resolved/unresolved critique ids. Gate next iteration on unresolved material issues, not generic style comments. Add tests where vague critique must be rejected or normalized into actionable feedback. | 2, 3 |
| Best-of-progress selection discards the strongest earlier candidate | Final answer gets worse after later refinement; selected candidate has lower score than previous iteration; "latest wins" behavior hides regression | Keep all candidate scores and gate outcomes. Best-of-progress must select from all accepted/attempted candidates using stable tie-breaking: pass threshold, higher rubric score, fewer unresolved critical issues, then earlier candidate to avoid needless drift. Test with fixtures where iteration 2 is better than iteration 3. | 3 |
| Stop reasons are conflated with failures | `no meaningful improvement`, `critique resolved`, and `human accept` appear as failed nodes; max iteration appears completed without explanation | Add explicit loop stop reason enum: `pass_threshold`, `critique_resolved`, `no_meaningful_improvement`, `max_iterations`, `budget_exhausted`, `human_accept`, `cancelled`, `error`. Map non-error stops to completed status with visible reason; map budget exhaustion according to whether a usable candidate exists. | 1, 4 |
| Model override semantics break inside loop phases | Node card shows one model but critique/refine/gate use hidden models; user override meant for draft accidentally applies to judge; selected-model errors are swallowed | Extend model metadata from node-level only to phase-level: `draftModel`, `critiqueModel`, `refineModel`, `gateModel`, `bestOfProgressModel`, each with planned/effective/override source. Fail strictly on invalid explicit phase override, matching existing selected-model failure policy. | 1, 4 |
| Approval modes accidentally bypass new safety gates | `initial-plan` auto-runs recursive loop branches forever; human cannot pause after a bad critique; loop-created artifacts bypass approval expectations | Treat loop expansion as internal execution but keep pause/cancel/human accept authoritative. `initial-plan` may auto-run bounded iterations, but budget extension, tool use, or unsafe artifact writes must still require explicit approval. Add UAT for pause future auto-approvals during a running loop. | 1, 4, 5 |
| Structured outputs degrade because refinement rewrites schemas | JSON/artifact candidates become invalid after refinement; validator passes text summaries instead of strict artifact refs; schema validation happens only at final answer | For structured artifacts, validate every candidate against `ArtifactContract` before scoring. Critique may discuss schema failures, but the refiner must receive the schema and prior validation errors. Best-of-progress can only select schema-valid candidates unless user explicitly accepts invalid output. | 2, 3 |

## Moderate Risks

| Pitfall | Warning Signs | Prevention Strategy | Phase |
|---|---|---|---|
| Evaluator prompt injection from candidate content | Candidate tells judge to ignore rubric; judge score spikes after adversarial text; critique includes candidate instructions as evaluator instructions | Wrap candidate, prompt, and rubric in clearly separated data fields. In evaluator system prompt, state candidate content is untrusted. Add adversarial fixtures where candidate attempts to override scoring. | 2, 5 |
| Tool permissions leak into critique/refine steps | Evaluator requests tools although tools are disabled; critique uses shell/web unexpectedly; tool-call failures mark whole loop unclearly | Default loop evaluator/gate steps to no tools. If tool-assisted evaluation is later allowed, make it explicit per rubric and count tool rounds against existing `maxToolRounds`. Test that disabled tool requests surface as structured loop errors. | 1, 2 |
| Trace volume grows until UI becomes noisy or slow | React Flow snapshots balloon; SSE refreshes lag; candidate text duplicated in graph nodes and trace events | Store compact per-iteration summaries in graph state and large drafts/critiques as artifact refs. UI should lazy-open loop history instead of rendering all text on node cards. Include a fixture with many iterations and long candidates. | 1, 4 |
| Score thresholds create false precision | Small score differences trigger extra iterations; candidate with 0.82 treated as meaningfully better than 0.80; thresholds differ by rubric without explanation | Use coarse bands or minimum-delta rules: e.g. improvement must exceed configured `minMeaningfulDelta` and reduce unresolved critical issues. Display threshold and delta reason in stop metadata. | 2, 3 |
| Loop failures erase usable partial work | One bad refine call fails the whole node even though a good candidate exists; final answer empty after late evaluator error | Track `bestUsableCandidate` continuously. On evaluator/refiner error, fail only if no usable candidate exists or strict policy requires it; otherwise complete with visible degraded stop reason and error metadata. | 3 |
| Recursion depth and loop iteration budgets conflict | A deep recursive task enters refinement at every leaf and explodes calls; depth selector does not estimate loop cost | Update budget estimation to multiply selected recursive nodes by loop phase costs. Show planned loop call budget in metadata/UI before run. Include tests combining `maxDepth`, `maxBranches`, and loop iterations. | 1, 5 |
| Human edits after loop planning invalidate rubric context | User edits node prompt but loop still uses old rubric; selected rubric no longer matches prompt; stale internal loop history appears current | Treat prompt/model/rubric edits as invalidating loop history. Record `rubricInputHash` or equivalent and clear stale candidates on edit. Recompute rubric before run after graph mutation. | 2, 4 |
| Rubric plugins become executable-code security holes | Future plugin-defined rubrics run arbitrary logic; local-first system executes untrusted evaluator code | Keep declarative rubrics separate from executable graders. If executable graders are later added, require explicit plugin capability, sandbox policy, and visible approval. For v1.2, prefer declarative criteria plus model grading. | 2 |

## Minor Risks

| Pitfall | Warning Signs | Prevention Strategy | Phase |
|---|---|---|---|
| UI labels confuse loop phase vs graph node status | Users see `completed` but not whether gate passed; "approval" and "gate" read as the same action | Use distinct copy: execution status, gate verdict, stop reason, and human approval are separate fields. | 4 |
| Rubric text bloats every model call | Prompt truncation removes task context; evaluator spends tokens repeating static criteria | Store canonical rubric ids and compact criteria. Include only active criteria and relevant prior critique ids in refine calls. | 2, 3 |
| Non-deterministic tests make regressions flaky | Judge tests fail intermittently; local model variance changes expected score | Use fake model ports for unit tests, golden traces for loop state transitions, and small live-model smoke tests only where appropriate. | 5 |
| Candidate ordering bias affects pairwise selection | First or last candidate wins disproportionately in fixtures | Shuffle or evaluate both A/B and B/A for calibration tests, then use deterministic order in production with documented tie-breakers. | 3, 5 |

## Testable Acceptance Hooks

- Low model-call budget produces a completed node with best usable candidate or a failed node with explicit `budget_exhausted`, never an empty silent fallback.
- Every loop run exposes selected rubric, iteration count, phase-level planned/effective models, stop reason, and selected candidate id in metadata and UI.
- Calibration fixtures prove the judge ranks known good/bad candidates correctly and resists verbosity, position, and prompt-injection attacks.
- Best-of-progress fixtures prove the selected candidate can be an earlier iteration.
- Prompt edit, model override, rubric change, cancellation, pause-auto-approval, and clarification interactions each have explicit loop-state regression tests.

## Sources

- Local project context: `.planning/PROJECT.md`, `.planning/REQUIREMENTS.md`, `src/domain/recursive-language-model.ts`, `src/domain/types.ts`, `src/application/execution-controller.ts`, `ui/src/main.tsx`.
- OpenAI, "Evaluation best practices" - recommends concrete eval objectives, continuous evaluation, pairwise/pass-fail grading, response-length controls, and attention to multi-agent edge cases. https://developers.openai.com/api/docs/guides/evaluation-best-practices
- OpenAI, "Graders" - grader prompts need examples, ground-truth grades, stability checks, and reward-hacking guardrails. https://developers.openai.com/api/docs/guides/graders/
- AWS Prescriptive Guidance, "Evaluator reflect-refine loop patterns" - describes generator/evaluator/refiner loops that stop on criteria, approval, or retry limits. https://docs.aws.amazon.com/prescriptive-guidance/latest/agentic-ai-patterns/evaluator-reflect-refine-loop-patterns.html
- Anthropic, "Demystifying evals for AI agents" - agent evals need tasks, trials, graders, assertions, and multi-turn state awareness because mistakes compound. https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents
- Madaan et al., "Self-Refine: Iterative Refinement with Self-Feedback" - evidence that iterative feedback/refinement can improve outputs, while still requiring bounded test-time control. https://arxiv.org/abs/2303.17651
- Dietz et al., "Principles and Guidelines for the Use of LLM Judges" - warns about circularity, self-reinforcing evaluator signals, and the need for independent checks. https://www.cs.unh.edu/~dietz/papers/dietz2025principles.pdf
