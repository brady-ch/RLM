# Phase 10: Cross-Platform Executable Packaging and Install UX - Context

**Gathered:** 2026-05-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver standalone cross-platform release packaging and install UX so a new user can install `rlm`, run it from any folder, and get a clear first-run path on macOS, Linux, and Windows without reading setup docs.

This phase covers:
- Standalone executable packaging for macOS, Linux, and Windows
- Global install command exposure on `PATH`
- Global and project config folder layout
- First-run mode selection and setup flow
- Installer/runtime messaging for missing prerequisites and startup guidance

Out of scope here: chat-first graph authoring behavior (Phase 9), node-embedded graph editing UX (Phase 11), and host/tool-calling behavior already scoped in earlier phases.

</domain>

<decisions>
## Implementation Decisions

### Packaging format and platform coverage
- **D-10-01:** Primary distribution target is standalone binaries for all three OS targets: macOS, Linux, and Windows.
- **D-10-02:** Reproducibility is not a phase-complete gate in Phase 10; build correctness comes first.
- **D-10-03:** The build/release work must cover all three OS targets in this phase, not a staged OS rollout.
- **D-10-04:** The standalone binary path is the primary supported release path.
- **D-10-05:** `npm i -g` remains a supported fallback path, but not the primary release story.

### PATH exposure and launch behavior
- **D-10-06:** `rlm` should be exposed on `PATH` via a native install shim as the primary mechanism.
- **D-10-07:** When launched from a folder, `rlm` should treat the current working directory as the active project root by default.

### Config scope and layout
- **D-10-08:** Phase 10 standardizes on a global config folder at `~/.rlm/` and a project-local config folder at `<project>/.rlm/`.
- **D-10-09:** Both scopes may exist; the project-local scope should be recommended for version control when appropriate.
- **D-10-10:** The top-level YAML file holds shared settings, with an `agents/` folder containing one file per agent and a `models/` folder containing one file per model.
- **D-10-11:** When both global and project config define the same agent id, the project entry replaces the global entry instead of merging field-by-field.
- **D-10-12:** Starter config files and sample agent/model files should be written to the current project only.

### First-run UX
- **D-10-13:** Every launch should prompt the user to choose `UI` or `CLI`.
- **D-10-14:** If the user does not specify a mode, default to `UI`.
- **D-10-15:** `UI` mode should open the browser, print a short CLI hint, and start with a sample graph.
- **D-10-16:** `CLI` mode should enter interactive prompt mode and wait for user input.
- **D-10-17:** The mode prompt should be a simple numbered choice.

### Setup and prerequisite handling
- **D-10-18:** If required runtime prerequisites are missing on first run, the tool should offer to install or configure what is needed.
- **D-10-19:** The setup step may install missing dependencies, write config files, and create starter `agents/` and `models/` files.
- **D-10-20:** The setup step should stay project-local rather than seeding global files.

### the agent's Discretion
- Exact packaging toolchain, artifact naming, and release automation.
- Exact config file names inside `~/.rlm/` and `<project>/.rlm/` as long as the folder structure and precedence remain intact.
- Exact UI copy for the first-run chooser, startup hints, and prerequisite prompts.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Milestone scope and requirement locks
- `.planning/ROADMAP.md` — Phase 10 goal, dependencies, and success criteria
- `.planning/REQUIREMENTS.md` — `DIST-01`, `DIST-02`, and `DIST-03` requirement definitions
- `.planning/PROJECT.md` — v1.1 milestone scope and no-silent-failure product stance

### Prior phase decisions that constrain behavior
- `.planning/phases/09-chat-first-graph-ux-and-clarification-stops/09-CONTEXT.md` — UI-first graph authoring and explicit prompt semantics that the first-run UX must not contradict
- `.planning/phases/08-model-host-extensibility-and-constrained-tool-calling/08-CONTEXT.md` — host/config precedence and explicit pause/fallback norms
- `.planning/phases/07-mcp-and-skills-interoperability/07-CONTEXT.md` — configuration and runtime auditability conventions

### Existing architecture and implementation touchpoints
- `AGENTS.md` — repo architecture boundaries and extension points
- `README.md` — current install, build, and CLI usage documentation
- `package.json` — current CLI entrypoint and build scripts
- `src/index.ts` — CLI composition root and runtime boot path
- `src/cli/args.ts` — argument parsing and command selection
- `src/application/project-config.ts` — config loading and runtime config resolution
- `src/application/control-server.ts` — interactive UI/control-plane server path
- `ui/src/main.tsx` — browser UI entry and first-run UI surface
- `ui/vite.config.ts` — UI build output and packaging path

### Codebase context references
- `.planning/codebase/STACK.md` — current runtime/build stack
- `.planning/codebase/ARCHITECTURE.md` — layered architecture and composition root responsibilities
- `.planning/codebase/INTEGRATIONS.md` — local system, UI, and runtime integration surfaces

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `package.json` scripts: current `build`, `build:ui`, and `start` scripts provide the existing release pipeline anchor.
- `src/index.ts`: already owns CLI bootstrapping and is the natural place to thread install-mode behavior.
- `src/application/project-config.ts`: already normalizes runtime config and is the right place to extend config scope resolution.
- `ui/src/main.tsx`: already hosts the browser UI entry and can surface the first-run UI mode behavior.
- `ui/vite.config.ts`: already defines the UI build output location needed for packaged releases.

### Established Patterns
- Config-driven behavior is already the repo norm, so release/install behavior should remain driven by resolved config rather than ad hoc flags.
- The repo already separates CLI, application orchestration, domain logic, and adapters, so install UX should stay in the CLI/composition layer.
- The current project already treats `cwd` as the natural local workspace anchor, which aligns with folder-local execution defaults.

### Integration Points
- Package/release scripts in `package.json`.
- Runtime config search/resolution in `src/application/project-config.ts`.
- CLI entry and mode selection in `src/index.ts` and `src/cli/args.ts`.
- UI bootstrap flow in `ui/src/main.tsx` and the control server path in `src/application/control-server.ts`.

</code_context>

<specifics>
## Specific Ideas

- Use a native install shim for `rlm` on `PATH`.
- Keep `npm i -g` as a supported fallback path.
- Prompt for `UI` or `CLI` on every launch, with `UI` as the default choice.
- `UI` mode should be browser-first and seed a sample graph.
- `CLI` mode should open an interactive prompt immediately.
- Global config lives in `~/.rlm/`, project config lives in `<project>/.rlm/`.
- The project config should be versionable when desired, but starter files should only be seeded into the current project.
- Config should be split into a top-level settings YAML plus `agents/` and `models/` folders with one file per entry.

</specifics>

<deferred>
## Deferred Ideas

- Strict reproducible build gating.
- Staged platform rollout by OS.
- Phase 11 node-embedded authoring and drag/edit interactions.

</deferred>

---

*Phase: 10-Cross-Platform Executable Packaging and Install UX*
*Context gathered: 2026-05-10*
