# Testing Strategy and Coverage

## Snapshot
- Date: 2026-05-08
- Primary framework: Node.js built-in test runner (`node:test`) with `assert`.

## Test Execution Model
- Command: `npm test`
- Behavior:
  - Compiles TS to `dist/`
  - Runs tests from built JS (`dist/tests/*.test.js`)
- Consequence:
  - Tests validate transpiled output behavior as executed by Node.

## Current Test Organization
- Core integration-style coverage concentrated in:
  - `tests/recursive-language-model.test.ts`
- Coverage includes:
  - recursion behavior and budgeting
  - CLI argument parsing
  - tool adapter behavior (shell/write/web-search/web-fetch)
  - workflow routing and QA logic
  - memory manager behaviors

## Test Patterns
- Uses fakes/mocks for model and tool behavior where needed.
- Emphasizes end-to-end-ish behavior of core orchestration pieces.
- Multiple scenario-based tests for recursion limits and control flow.

## Strengths
- Broad functional coverage of critical recursive engine paths.
- Includes regression checks for budget controls and tool-round behavior.
- Covers both direct and workflow-driven execution modes.

## Gaps and Risks
- Single large test file can be harder to maintain and navigate.
- No explicit coverage tooling or thresholds configured.
- UI test coverage is not visible in current tree.
- No dedicated smoke tests for CLI binary packaging/install paths.

## Recommended Next Testing Improvements
- Split test file into thematic modules (domain/application/adapters/cli).
- Add UI-level tests (component or integration) for `ui/src/main.tsx` behavior.
- Add minimal coverage reporting (if desired) or failure-driven quality gates.
- Add a small set of fixture-based workflow tests for long-term stability.
