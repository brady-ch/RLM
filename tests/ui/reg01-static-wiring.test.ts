import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const UI_ROOT = join(process.cwd(), "ui/src");

function readUi(relativePath: string): string {
  return readFileSync(join(UI_ROOT, relativePath), "utf8");
}

test("reg01 static wiring: TopBar posts pause-future-auto-approvals", () => {
  const source = readUi("app/TopBar.tsx");
  assert.match(source, /\/api\/pause-future-auto-approvals/);
  assert.match(source, /Pause future auto-approvals/);
});

test("reg01 static wiring: TopBar uses modern grouped action controls", () => {
  const source = readUi("app/TopBar.tsx");
  assert.match(source, /workflow-topbar-status/);
  assert.match(source, /workflow-topbar-actions/);
  assert.match(source, /Play/);
  assert.match(source, /Settings/);
  assert.match(source, /btn-topbar-primary/);
  assert.match(source, /btn-topbar-danger/);
});

test("reg01 static wiring: ModelLibraryPanel posts HF download route", () => {
  const source = readUi("advanced/models/ModelLibraryPanel.tsx");
  assert.match(source, /\/api\/model-library\/download/);
});

test("reg01 static wiring: FirstRunLauncher uses root-composer and saved-session APIs", () => {
  const source = readUi("app/FirstRunLauncher.tsx");
  assert.match(source, /data-testid="first-run-launcher"/);
  assert.match(source, /\/api\/nodes\/root-composer\/edit/);
  assert.match(source, /\/api\/nodes\/root-composer\/plan/);
  assert.match(source, /\/api\/saved-sessions/);
  assert.doesNotMatch(source, /from\s+['"][^'"]*advanced/);
});

test("reg01 static wiring: Rust routes register Phase 62 endpoints", () => {
  const routes = readFileSync(
    join(process.cwd(), "crates/rlm-core/src/control_server/routes.rs"),
    "utf8",
  );
  assert.match(routes, /pause-future-auto-approvals/);
  assert.match(routes, /model-library\/download/);
});
