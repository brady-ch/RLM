# Codebase Concerns and Technical Debt

## Snapshot
- Date: 2026-05-08
- Scope: high-level risks and maintainability concerns observed from structure and source scanning.

## Concern 1: Concentrated Complexity in Core Engine
- Area: `src/domain/recursive-language-model.ts`
- Why it matters:
  - Very large, high-responsibility module handling recursion, budgets, tool orchestration, and execution graph updates.
- Risk:
  - Harder onboarding, higher regression risk when changing intertwined behavior.
- Suggested mitigation:
  - Incrementally extract helper modules by concern (budgeting, tool-loop handling, graph events).

## Concern 2: Large Composition Surface in Entrypoint
- Area: `src/index.ts`
- Why it matters:
  - Wiring CLI, tools, models, execution modes, and workflow behavior in one file increases cognitive load.
- Risk:
  - Changes to boot logic may unintentionally affect unrelated flows.
- Suggested mitigation:
  - Introduce focused factory/composition modules for model setup, tool registration, and run-mode dispatch.

## Concern 3: External Search Fragility
- Area: `src/adapters/web-search-tool.ts`
- Why it matters:
  - HTML scraping of third-party search output is inherently brittle.
- Risk:
  - Parser breakage from upstream markup changes; inconsistent behavior across environments.
- Suggested mitigation:
  - Improve fallback handling and parser tests; isolate parser assumptions with clearer fixtures.

## Concern 4: Limited Automated Style Guardrails
- Area: repository-wide tooling
- Why it matters:
  - No explicit lint/format scripts surfaced in `package.json`.
- Risk:
  - Style and minor correctness drift over time.
- Suggested mitigation:
  - Add lint and format scripts (or document explicit rationale for not using them).

## Concern 5: Testing Structure Scalability
- Area: `tests/recursive-language-model.test.ts`
- Why it matters:
  - Single-file concentration can become bottleneck for maintainability.
- Risk:
  - Slower test comprehension and harder targeted failure ownership.
- Suggested mitigation:
  - Split by subsystem and preserve integration coverage with shared helpers.

## Potential Security/Operational Notes
- Shell tool has explicit allowlist checks, which is good.
- Still sensitive to command parsing edge cases and runtime environment differences.
- Local model/network assumptions should be validated in deployment docs for non-dev usage.
