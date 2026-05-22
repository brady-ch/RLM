# Desktop Packaging

RLM ships a Tauri native shell with a Rust CLI runtime. Staging smoke validates the release folder; deb smoke validates the Linux installer.

## Native shell

```bash
npm run tauri:dev
npm run tauri:build
```

The Tauri config lives under `src-tauri/` and uses the React UI build as its frontend bundle. Tauri bundles the staged release folder from `dist/release/` and starts the packaged `rlm ui` runtime as an app-managed child process. Closing the native window stops that RLM-managed child process.

## Linux build prerequisites

```bash
sudo apt-get update
sudo apt-get install -y libglib2.0-dev libgtk-3-dev libwebkit2gtk-4.1-dev libayatana-appindicator3-dev librsvg2-dev
```

Without these packages, `npm run tauri:build` fails before compiling the app because `pkg-config` cannot find libraries such as `glib-2.0`, `gtk+-3.0`, and `webkit2gtk-4.1`.

## Staged release layout

`npm run package:smoke` builds the UI, stages a desktop-ready release folder, and verifies required launch assets.

The staged release is written to:

```text
dist/release/<platform>-<arch>/
```

Contents:

- `bin/rlm` — Rust CLI binary (control server + CLI entry)
- `ui-dist/` — static UI assets from the Vite build
- `rlm` and `rlm.cmd` — Unix and Windows launcher shims that invoke the Rust binary
- `desktop-manifest.json` — platform, `runtime.kind: rust-binary`, launch, UI, and Ollama metadata for installer tooling

The staged launcher does not require a user-installed Node/npm on the same platform it was packaged for.

Ollama behavior:

- By default, the embedded runtime checks `OLLAMA_HOST` or `http://127.0.0.1:11434`.
- Set `RLM_MANAGE_OLLAMA=1` to let the runtime start `ollama serve`.
- Startup exits non-zero if Ollama is unavailable and unmanaged.

## Deb install smoke

Tauri produces a Debian package when building on Linux:

```bash
npm run tauri:build
# → src-tauri/target/release/bundle/deb/*.deb
```

Install and smoke-test the newest `.deb`:

```bash
npm run package:smoke:deb
```

This script installs with `sudo dpkg -i`, runs `rlm --help` on the installed CLI, optionally smoke-starts the desktop binary under `xvfb-run`, and uninstalls in a `finally` block. Local runs require sudo and the same apt packages as `tauri:build`.

**Skip behavior (exit 0, not a failure):**

- `RLM_SKIP_DEB_SMOKE=1` — explicit skip for developers or scripts that should not attempt deb install
- Linux hosts missing Tauri build prerequisites (`pkg-config --exists glib-2.0` fails) — auto-skip with a message pointing here

Developers on macOS/Windows or WSL laptops without GTK/WebKit deps are not blocked by `npm run package:smoke`.

**CI:** Headless validation runs on `ubuntu-latest` in [`.github/workflows/deb-smoke.yml`](../.github/workflows/deb-smoke.yml). The job installs apt deps, runs `tauri:build`, then `package:smoke:deb` without setting `RLM_SKIP_DEB_SMOKE`. Missing deps on CI is a hard failure.

Cross-platform staging-only smoke (no `.deb` install) remains in [`.github/workflows/package-smoke.yml`](../.github/workflows/package-smoke.yml).

Native signing/notarization and store distribution remain outside v1.3.
