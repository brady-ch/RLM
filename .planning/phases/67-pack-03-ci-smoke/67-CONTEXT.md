# Phase 67: PACK-03 CI Smoke — Context

**Gathered:** 2026-05-22  
**Status:** Ready for planning  
**Source:** Infrastructure phase — discuss skipped; derived from ROADMAP goal, PACK-01, Phase 60 deferral, and `rust-functional-debt-wave1.md` F6

<domain>
## Phase Boundary

Close the v1.8 PACK-03 deferral: release CI must install a Tauri-built Linux `.deb` and smoke-start the packaged binary on headless hosts. Local developers without GTK/WebKit build deps must get documented, non-failing skip behavior — not silent failure or blocked `npm run package:smoke`.

Out of scope: Windows/macOS installer CI, code signing, store distribution, full `npm run check:rust` workspace gate (deferred to milestone close per autonomous run policy).

</domain>

<decisions>
## Implementation Decisions

### CI smoke strategy (D-01)
- Add a dedicated Linux GitHub Actions job (do not remove the existing cross-platform `package-smoke.yml` matrix).
- Job installs Tauri Linux build deps from `docs/DESKTOP.md`, runs `npm run tauri:build`, then runs a new deb smoke npm script.
- Use `xvfb-run` for any step that launches the installed desktop binary; CLI `--help` smoke runs without a display.

### Deb artifact contract (D-02)
- Smoke script discovers the newest `.deb` under `src-tauri/target/release/bundle/deb/` (Tauri 2 default layout).
- Install with `sudo dpkg -i` (fix deps via `sudo apt-get install -f -y` on failure) into the CI runner; uninstall in a `finally` block when possible.
- After install, resolve the packaged CLI/desktop entry from `dpkg -L` (prefer `bin/rlm` or the Tauri-generated desktop binary under `/usr/bin`).

### Skip behavior for unsupported hosts (D-03)
- New env `RLM_SKIP_DEB_SMOKE=1` exits 0 immediately with a single stderr line documenting the skip.
- Without the env var, auto-detect missing Tauri build prerequisites (e.g. `pkg-config --exists glib-2.0` fails on Linux) and exit 0 with an actionable message pointing to `docs/DESKTOP.md` — do not fail `npm run package:smoke` on WSL/dev laptops lacking GTK.
- CI job must never set `RLM_SKIP_DEB_SMOKE`; missing deps there is a hard failure.

### Smoke assertions (D-04)
- Minimum smoke: installed `rlm --help` (or discovered packaged binary) exits 0.
- Desktop smoke: `xvfb-run -a timeout 15s <desktop-binary>` or equivalent — process starts without GTK/dbus errors on stderr; non-zero from `timeout` after clean start is acceptable.
- Reuse patterns from `scripts/packaging/smoke-release.mjs` (spawnSync, explicit exit codes, stderr diagnostics).

### Claude's Discretion
- Exact workflow filename (`deb-smoke.yml` vs extending `package-smoke.yml`) and npm script names (`package:smoke:deb` suggested).
- Whether deb smoke runs on every push or only `main` + `workflow_dispatch` (prefer matching existing release-smoke triggers).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Packaging
- `scripts/packaging/build-release.mjs` — release staging (rust-binary layout)
- `scripts/packaging/smoke-release.mjs` — staged folder smoke pattern
- `src-tauri/tauri.conf.json` — deb target + bundled `dist/release` resources
- `docs/DESKTOP.md` — Linux apt prerequisites (needs update for Rust-only layout + skip docs)

### Prior phase deferral
- `.planning/milestones/v1.8-phases/60-tauri-in-process-packaging/60-01-SUMMARY.md` — PACK-03 CI deferred
- `.planning/todos/pending/rust-functional-debt-wave1.md` — F6 acceptance criteria

### CI baseline
- `.github/workflows/package-smoke.yml` — existing cross-platform staging smoke (keep)

</canonical_refs>

<deferred>
## Deferred Ideas

- Windows `.msi` / macOS `.dmg` install smoke in CI
- Signed/notarized release artifacts (INFR-06)
- Docker-based smoke as alternative to bare `ubuntu-latest` (only if xvfb approach fails in execution)

</deferred>

---

*Phase: 67-pack-03-ci-smoke*  
*Context gathered: 2026-05-22 — infrastructure phase, discuss skipped*
