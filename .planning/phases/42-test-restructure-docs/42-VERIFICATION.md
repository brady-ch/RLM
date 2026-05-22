# Phase 42 Verification

## Automated

- **`npm run check`** — PASSED (`tsc`, ESLint, Prettier check, dependency-cruiser, full test run).
- **Test discovery** — `node --test dist/tests` executes nested `dist/tests/**/*.test.js` files.

## Parity

| Metric | Before (`07523a0`) | After |
|--------|-------------------|--------|
| Top-level `test(` across `tests/**/*.ts` | 211 | 230 (+19 seam units) |
| `recursive-language-model` suite top-level tests | 129 | 129 (file moved, blocks verbatim) |

## Integration anchors

The following files were not modified in this phase (only global test runner changed):

- `tests/integration-v15.test.ts`
- `tests/graph-workflow.test.ts`
- `tests/graph-executor.test.ts`
- `tests/graph-planner.test.ts`
- `tests/session-memory-bridge.test.ts`

## Doc

- [`AGENTS.md`](../../../AGENTS.md) lists `application/config/`, `application/bootstrap/`, `domain/recursion/`, adapter groups, `control-server/handlers/`, `tests/helpers/`, and `tests/domain/recursion/`.
