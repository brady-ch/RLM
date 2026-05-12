# Phase 10: Cross-Platform Executable Packaging and Install UX - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-10
**Phase:** 10-cross-platform-executable-packaging-and-install-ux
**Areas discussed:** Packaging format and build pipeline, Global install path and command invocation, First-run UX contract

---

## Packaging Format and Build Pipeline

| Option | Description | Selected |
|--------|-------------|----------|
| Single bundled Node app + platform launchers | Fastest path; still requires Node on user machine. | |
| True standalone binaries per OS | No Node prerequisite for end users; more packaging complexity. | ✓ |
| Hybrid | Ship standalone binaries as primary, keep npm/npx path as fallback/dev path. | |

**User's choice:** True standalone binaries per OS
**Notes:** Chosen as the cleanest fit for the phase goal.

### Follow-up decisions

| Option | Description | Selected |
|--------|-------------|----------|
| Unsigned binaries initially | Focus on functionality first; signing/notarization deferred. | ✓ |
| Basic signing where straightforward | Sign where tooling is easy in CI; allow temporary gaps. | |
| Full signing/notarization required before phase complete | macOS notarization + signing strategy across all OS artifacts is part of done criteria. | |

**User's choice:** Unsigned binaries initially
**Notes:** Packaging can ship functionally first; signing is deferred.

### Follow-up decisions

| Option | Description | Selected |
|--------|-------------|----------|
| Best-effort reproducible builds | Pin tool versions and document build env, but no strict byte-for-byte guarantee gate. | |
| Strict reproducible build gate | CI must prove deterministic artifacts for same commit. | |
| Defer reproducibility work | Build correctness first; reproducibility moved to a follow-up phase. | ✓ |

**User's choice:** Defer reproducibility work
**Notes:** Reproducibility is not a phase-complete gate for Phase 10.

### Follow-up decisions

| Option | Description | Selected |
|--------|-------------|----------|
| Implement all three OS targets in this phase | macOS, Linux, and Windows. | ✓ |
| Implement macOS + Linux first, define Windows contract/tests now | Two-step rollout with Windows deferred. | |
| Implement one reference OS first, others as follow-up phases | Narrow rollout and postpone the rest. | |

**User's choice:** Implement all three OS targets in this phase
**Notes:** Phase 10 should cover macOS, Linux, and Windows together.

---

## Global Install Path and Command Invocation

| Option | Description | Selected |
|--------|-------------|----------|
| Direct binary download/install (primary) | Official path is downloading platform binary and placing it on PATH. | |
| npm global install (primary) | `npm i -g` path is the main UX; binary artifacts are secondary. | |
| Both first-class | Docs and tests treat direct binary and npm-global as equal primary entry points. | ✓ |

**User's choice:** Both first-class
**Notes:** The standalone binary path remains primary, but `npm i -g` is kept as a supported fallback.

### Follow-up decisions

| Option | Description | Selected |
|--------|-------------|----------|
| Native install shim | Works even when the binary lives inside an app bundle or unpacked install dir; keeps the command stable. | ✓ |
| Symlink to installed binary | Simpler on macOS/Linux; not ideal for Windows and can break if install layout changes. | |
| npm wrapper script | Familiar Node CLI behavior; assumes npm remains part of the supported install story. | |

**User's choice:** Native install shim
**Notes:** Chosen as the cleanest `PATH` exposure option.

### Follow-up decisions

| Option | Description | Selected |
|--------|-------------|----------|
| Use the current working directory automatically as project root | Folder-local execution follows the launch directory. | ✓ |
| Require `--config` or explicit project path every time | More explicit, but slows down first-run and common usage. | |
| Auto-detect the nearest `rlm.config.yaml`, otherwise fall back to `cwd` | More complex resolution path with implicit search. | |

**User's choice:** Use the current working directory automatically as project root
**Notes:** The user also wants both global and project config scopes.

### Follow-up decisions

| Option | Description | Selected |
|--------|-------------|----------|
| `~/.config/rlm/` for global config and `<project>/.rlm/` for project config | Conventional xdg-style global path. | |
| `~/.rlm/` for global config and `<project>/.rlm/` for project config | Simple repo-specific global path. | ✓ |
| Let the agent decide the exact paths, but require both global and project scopes | Preserves scope but leaves paths undefined. | |

**User's choice:** `~/.rlm/` for global config and `<project>/.rlm/` for project config
**Notes:** The config model should support both scopes.

### Follow-up decisions

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, commit it to source control | Versioned project config is mandatory. | |
| No, keep it local-only and ignored by default | Prevents checking project config into repos. | |
| Both are allowed, but docs should recommend versioned project config | Flexible repository policy. | ✓ |

**User's choice:** Both are allowed, but docs should recommend versioned project config
**Notes:** Project config may be versioned, but it is not required.

### Follow-up decisions

| Option | Description | Selected |
|--------|-------------|----------|
| Single `rlm.config.yaml` in each scope | Simplest; agents and runtime settings live together. | |
| `config.yaml` plus `agents.yaml` | Clean separation; easier to version agents independently. | |
| Folder of scoped YAML files | Most flexible, but more complex to load and document. | ✓ |

**User's choice:** Folder of scoped YAML files
**Notes:** Top-level YAML for settings, `agents/` folder one file per agent, `models/` folder one file per model.

### Follow-up decisions

| Option | Description | Selected |
|--------|-------------|----------|
| Merge by agent id, with project config overriding fields from global config | Field-level merge across scopes. | |
| Replace the full agent entry if the project defines the same id | Project entry wins as a whole object. | ✓ |
| Keep both and require explicit selection at runtime | Preserves both versions and adds runtime selection complexity. | |

**User's choice:** Replace the full agent entry if the project defines the same id
**Notes:** This is the configured precedence behavior for duplicate agent ids.

---

## First-Run UX Contract

| Option | Description | Selected |
|--------|-------------|----------|
| Open the UI automatically and start in a ready state | Browser-first without a mode prompt. | |
| Start in CLI mode and show a clear prompt to open the UI | CLI-first with UI available as a follow-up. | |
| Ask the user to choose UI-first or CLI-first on first run | Explicit mode selection every launch. | ✓ |

**User's choice:** Ask the user to choose UI or CLI each run
**Notes:** The prompt should happen every launch, not just the first launch.

### Follow-up decisions

| Option | Description | Selected |
|--------|-------------|----------|
| Default to `UI` | Browser-first when the user does not specify. | ✓ |
| Default to `CLI` | Text-first when the user does not specify. | |
| No default; require an explicit choice every time | Forces the user to always choose. | |

**User's choice:** Default to `UI`
**Notes:** UI should be the default choice.

### Follow-up decisions

| Option | Description | Selected |
|--------|-------------|----------|
| Open a browser to the local UI and stop there | Minimal browser-first launch. | |
| Open the browser and also print a short CLI hint | Browser-first with a small console affordance. | |
| Open the browser, print a hint, and start with a sample graph | Browser-first with a starter graph. | ✓ |

**User's choice:** Open the browser, print a hint, and start with a sample graph
**Notes:** This is the desired `UI` launch behavior.

### Follow-up decisions

| Option | Description | Selected |
|--------|-------------|----------|
| Enter interactive prompt mode and wait for user input | CLI mode becomes the main interactive shell. | ✓ |
| Print usage/help and exit | CLI mode is informational only. | |
| Run a sample command or demo prompt automatically | CLI mode is guided but not interactive. | |

**User's choice:** Enter interactive prompt mode and wait for user input
**Notes:** This is the desired `CLI` launch behavior.

### Follow-up decisions

| Option | Description | Selected |
|--------|-------------|----------|
| A simple numbered choice | Minimal, explicit, and easy to parse. | ✓ |
| A short explanation plus numbered choice | Slightly more verbose. | |
| A full-screen launcher-style prompt with extra context | Heavier UI for the mode selection step. | |

**User's choice:** A simple numbered choice
**Notes:** Keep the mode prompt straightforward.

### Follow-up decisions

| Option | Description | Selected |
|--------|-------------|----------|
| Fail with a clear error and fix instructions | Hard stop on missing prerequisites. | |
| Offer to install or configure what is missing | Guided recovery path. | ✓ |
| Fall back to a limited demo mode with warnings | Hidden limitations but usable. | |

**User's choice:** Offer to install or configure what is missing
**Notes:** The tool should help the user fix prerequisites rather than stopping silently.

### Follow-up decisions

| Option | Description | Selected |
|--------|-------------|----------|
| Install missing runtime dependencies only | Narrow setup surface. | |
| Install dependencies and write default config files | Guided bootstrap with config generation. | |
| Install dependencies, write config files, and create starter agents/models files | Full setup bootstrap. | ✓ |

**User's choice:** Install dependencies, write config files, and create starter agents/models files
**Notes:** The setup step can fully bootstrap a new project.

### Follow-up decisions

| Option | Description | Selected |
|--------|-------------|----------|
| Global config only | Seed shared defaults only. | |
| Current project only | Keep bootstrap local to the active repo. | ✓ |
| Both global and project, with project seeded from global defaults | Bootstrap both scopes. | |

**User's choice:** Current project only
**Notes:** Starter files should be written only into the current project.

## the agent's Discretion

- Exact build/release tooling and artifact naming.
- Exact config file names inside the chosen folder layout.
- Exact user-facing copy for prompts, hints, and prerequisite recovery.

## Deferred Ideas

- Strict reproducible build gating.
- Staged OS rollout.
- Signing/notarization work.

---

## Summary

Phase 10 should ship standalone cross-platform binaries as the primary release path, expose `rlm` through a native shim, keep `npm i -g` as a supported fallback, and standardize a two-scope config layout using `~/.rlm/` plus `<project>/.rlm/`. The first-run experience should prompt for `UI` or `CLI` every launch, default to `UI`, and bootstrap missing prerequisites with project-local starter config, agent, and model files.
