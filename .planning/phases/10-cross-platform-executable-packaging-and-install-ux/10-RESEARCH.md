# Phase 10 — Technical Research: Cross-Platform Packaging and Install UX

## RESEARCH COMPLETE

**Question answered:** What do we need to know to plan executable distribution and zero-doc first-run for this Node + Vite UI repo?

---

## Repo constraints (facts)

- **Runtime:** Node ESM (`"type": "module"`), TypeScript builds to `dist/` via `tsc`.
- **CLI entry:** `package.json` `bin.rlm` → `dist/src/index.js` with shebang.
- **UI:** Vite production build (`build:ui`); static assets must ship **inside** or **beside** the executable for packaged UX.
- **Dynamic loading:** Extension host uses dynamic `import()` of user-approved paths — packaging must not break native `import` resolution for packaged layout (or must document supported packaging mode vs dev).
- **Decisions locked in CONTEXT:** Three OS targets in-phase; reproducibility not a completion gate; `npm i -g` remains fallback; global `~/.rlm/` + project `<cwd>/.rlm/` with project overriding global per agent id.

---

## Packaging toolchain options

| Approach | macOS / Linux / Windows | ESM / dynamic import | UI static assets | Notes |
|----------|-------------------------|----------------------|------------------|-------|
| **Node SEA (Single Executable Application)** | Supported (per-platform blob) | First-class for Node 20+ | Embed via asset bundle or read from adjacent `ui/` dir | Official; requires `node` blob + preparation script; good for “one file + sidecar assets” |
| **@vercel/pkg / community forks** | Historical choice | ESM limitations; watch dynamic imports | Often `snapshot` or extra files | Verify fork maintenance before betting long-term |
| **Bun compile** | Cross-compile story evolving | Different runtime semantics | Possible | Risk: behavior drift from Node production stack |
| **Installer + embedded Node** (e.g. tar/zip with `node` + app) | Simple | Full fidelity | Ship `dist/` + `node` + launcher script | Not single file but meets “one download, extract, rlm on PATH” |

**Recommendation for planning:** Prefer **release bundles** that are reproducible *operationally* (documented CI matrix + consistent naming) over a single binary if SEA/pkg fights ESM/extensions — but phase success criteria still ask for “single executable”; treat **SEA or maintained pkg-class bundler** as primary design target with **documented fallback** (fat tarball with launcher) only if a blocker is discovered during execution.

---

## Global CLI and cwd

- **PATH shim:** Ship `rlm` launcher that resolves to packaged Node + app entry (or native stub that `exec`s the right artifact). On Windows, `.cmd`/PowerShell shim is required.
- **cwd:** Node already receives `process.cwd()` — plans should assert all project resolution uses cwd (already norm per CONTEXT/code_context) and does not depend on install location.

---

## Config layout implementation notes

- Resolve order: load global defaults from `~/.rlm/` then apply project `<cwd>/.rlm/` with **replace-on-id** for agents/models per D-10-11.
- Directory layout: top-level settings YAML + `agents/*.yaml` + `models/*.yaml` (exact filenames planner discretion).

---

## First-run UX (technical)

- Interactive **numbered** prompt on TTY before heavy work: `UI` vs `CLI` (default UI per CONTEXT).
- Non-interactive / CI: respect env flag or default documented (avoid blocking automation).
- “Offer to install prerequisites” must not auto-execute privileged installers without explicit confirmation (security).

---

## Validation Architecture

Phase verification should combine:

1. **Automated:** `npm run build`, `npm run build:ui`, packaging script dry-run in CI (matrix: ubuntu, macos, windows where available), existing `npm test` for regressions.
2. **Artifact checks:** Assert expected output filenames exist post-build; smoke `rlm --help` (or packaged equivalent) exits 0.
3. **Manual / human UAT:** First-run chooser, browser opens, sample graph visible, no manual YAML editing — align with `09` UI patterns without regressing chat-first behavior.

**Nyquist dimension 8:** Each plan task carries `<verify>` and acceptance criteria tied to commands or observable CLI output; packaging wave adds at least one automated “built artifact exists + launches help” check.

---

## Open risks (for executor awareness)

- **SEA + dynamic extension imports:** May require `import.meta.url` base path tuning or restricting packaged mode to built-in extensions only until validated.
- **Code signing:** Roadmap mentions signed artifacts; CONTEXT defers strict reproducibility — plan signing as platform-specific follow-on tasks with clear “best effort / CI stub” acceptance.

---

*Phase 10 — research for `/gsd-plan-phase 10`*
