# Phase 66 Context — CLI Full Parity

**Goal:** Rust `rlm` binary replaces Node for all documented CLI workflows.

**Requirements:** CLI-01, CLI-02, REG-02

**Upstream:** Phase 65 skill interop (complete)

**Reference TypeScript:**
- `src/cli/args.ts` — full flag surface
- `src/cli/run-modes/plan-node.ts`, `workflow-graph-io.ts`, `session-commands.ts`, `agent-workflow.ts`
- `crates/rlm-cli/src/main.rs`, `commands/mod.rs` — Rust CLI entry

**Success criteria (from ROADMAP):**

1. `plan-node`, `workflow-export`, `workflow-import` implemented (no exit-2 stubs)
2. Session/memory flags and approval/plan-only/workflow/agent config match `args.ts`
3. Parity CI covers new commands; README workflows run with `RLM_RUNTIME=rust` only

**Out of scope:**

- First-run launch wizard (`RLM_NON_INTERACTIVE` parity deferred)
- Implicit `rlm "prompt"` without `ask` subcommand (explicit subcommands sufficient for CLI-01)
