import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const UI_ROOT = join(process.cwd(), "ui/src");

function readUi(relativePath: string): string {
  return readFileSync(join(UI_ROOT, relativePath), "utf8");
}

test("reg03 static wiring: WorkflowOverview renders memory budget summary", () => {
  const source = readUi("run-panel/WorkflowOverview.tsx");
  assert.match(source, /resourceGuard/);
  assert.match(source, /availableRamMb/);
  assert.match(source, /peakModelRamMb/);
  assert.match(source, /runBlockedReason/);
});

test("reg03 static wiring: TopBar disables Run when resourceGuard blocks", () => {
  const source = readUi("app/TopBar.tsx");
  assert.match(source, /resourceGuard\?\.runBlocked/);
  assert.match(source, /runBlockedReason/);
  assert.match(source, /disabled=\{runBlocked\}/);
  assert.match(source, /Memory guard:/);
});

test("reg03 static wiring: session idle fixture includes resourceGuard", () => {
  const fixture = readFileSync(
    join(process.cwd(), "tests/fixtures/control-server/session-idle.json"),
    "utf8",
  );
  assert.match(fixture, /"resourceGuard"/);
  assert.match(fixture, /"runBlocked"/);
  assert.match(fixture, /"peakModelRamMb"/);
});
