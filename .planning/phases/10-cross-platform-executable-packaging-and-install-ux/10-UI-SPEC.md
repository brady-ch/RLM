# Phase 10 — UI Design Contract (Install & First-Run)

**Phase:** Cross-Platform Executable Packaging and Install UX  
**Status:** Planning input — visual/interaction contract for first-run and install messaging surfaces

---

## Scope

This contract covers **user-visible** install and first-run behavior that appears in the **terminal** and **browser UI** after packaging. It does not redefine Phase 9 chat-first graph editing semantics.

---

## First-run mode chooser (terminal)

**When:** Every **interactive** CLI launch (TTY detected), before starting UI server or blocking interactive CLI session, unless a non-interactive override is active (documented env flag for CI/automation).

**Presentation:**

- Clear title line: e.g. `How do you want to use RLM?`
- Numbered options:
  1. **UI** (default — Enter selects)
  2. **CLI**
- Short hint: UI opens the control dashboard in the browser; CLI stays in the terminal.

**Accessibility:**

- Options are readable plain text; user can type `1` or `2` plus Enter.
- Default is explicit in the copy (not silent).

**After selection:**

- **UI:** Print **one** short line with local URL (if applicable) + how to stop (Ctrl+C). Open browser per existing control-server behavior. Load **sample graph** in session (per CONTEXT D-10-15).
- **CLI:** Print one line that interactive prompt is active, then enter existing CLI flow.

---

## Prerequisite / setup prompts

**When:** Required runtime pieces missing (e.g. no usable config, missing model host if blocking, etc. — exact triggers in implementation).

**Rules:**

- Never claim success silently; always state what failed and next step.
- Any offer to **install** or **run privileged** commands requires **explicit** user confirmation — no auto-elevate.
- Prefer **project-local** seed files (`<cwd>/.rlm/`) per D-10-12 / D-10-20.

**Copy tone:** Short, imperative, no internal stack traces in user-facing lines (log details to stderr in verbose mode only).

---

## Browser (packaged UI)

- First landing after packaged install should match Phase 9: user can see graph surface and is not stuck behind undocumented config.
- **Visible focus:** Primary actions (confirm run, chat input) retain focus rings per product a11y rules.

---

## Explicit non-goals (Phase 10)

- Redesign of node-embedded editing (Phase 11).
- New clarification-stop semantics (Phase 9 owns that contract).

---

*Supports DIST-03 zero-doc first-run narrative.*
