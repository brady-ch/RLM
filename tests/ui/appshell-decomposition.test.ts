import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const UI_ROOT = join(process.cwd(), "ui/src");

function readUi(relativePath: string): string {
  return readFileSync(join(UI_ROOT, relativePath), "utf8");
}

function lineCount(relativePath: string): number {
  return readUi(relativePath).split("\n").length;
}

test("AppShell is under 200 lines after decomposition", () => {
  assert.ok(lineCount("app/AppShell.tsx") < 200, "AppShell should be under 200 lines");
});

test("AppShell does not fetch model, plugin, or memory domains", () => {
  const source = readUi("app/AppShell.tsx");
  for (const endpoint of ["/api/model-library", "/api/plugins", "/api/memory"]) {
    assert.doesNotMatch(source, new RegExp(endpoint), `AppShell must not fetch ${endpoint}`);
  }
});

test("useWorkflowSession owns session SSE refresh", () => {
  const source = readUi("app/hooks/useWorkflowSession.ts");
  assert.match(source, /EventSource/);
  assert.match(source, /\/api\/session/);
  assert.match(source, /\/api\/events/);
});

test("Advanced views fetch own domain data on mount", () => {
  assert.match(readUi("advanced/ModelsView.tsx"), /\/api\/model-library/);
  assert.match(readUi("advanced/PluginsView.tsx"), /\/api\/plugins/);
  assert.match(readUi("advanced/MemoryView.tsx"), /\/api\/memory/);
  assert.match(readUi("advanced/SessionsView.tsx"), /\/api\/saved-sessions/);
  assert.match(readUi("advanced/SettingsView.tsx"), /\/api\/graph-workflows/);
});

test("useGraphCanvas syncs node UI when planning and selection change", () => {
  const source = readUi("app/hooks/useGraphCanvas.ts");
  assert.match(source, /nodeUiStateKey/);
  assert.match(source, /planningNodeId/);
  assert.match(source, /planningError/);
  assert.match(source, /selectedNodeId/);
});
