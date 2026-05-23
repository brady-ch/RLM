import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const UI_ROOT = join(process.cwd(), "ui/src");

function readUi(relativePath: string): string {
  return readFileSync(join(UI_ROOT, relativePath), "utf8");
}

function listTsFiles(dir: string): string[] {
  const entries = readdirSync(dir);
  const files: string[] = [];
  for (const entry of entries) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      files.push(...listTsFiles(full));
    } else if (/\.tsx?$/.test(entry)) {
      files.push(full);
    }
  }
  return files;
}

test("run-panel/ must not import from advanced/", () => {
  const runPanelDir = join(UI_ROOT, "run-panel");
  const files = listTsFiles(runPanelDir);
  assert.ok(files.length > 0, "expected run-panel source files");

  for (const file of files) {
    const source = readFileSync(file, "utf8");
    assert.doesNotMatch(
      source,
      /from\s+['"][^'"]*advanced/,
      `${file} must not import from advanced/`,
    );
  }
});

test("RunPanel excludes prompt edit, plan actions, and domain panels", () => {
  const source = readUi("run-panel/RunPanel.tsx");
  const forbidden = [
    "node-inspector",
    "NodeInspector",
    "ModelLibrary",
    "PluginPanel",
    "MemoryPanel",
    "SavedSession",
    "/plan",
    "Plan children",
    "Break down",
  ];
  for (const pattern of forbidden) {
    assert.doesNotMatch(source, new RegExp(pattern), `RunPanel must not contain ${pattern}`);
  }
  assert.match(source, /\/approve/);
  assert.match(source, /clarification/i);
  assert.match(source, /if\s*\(\s*!selectedNode\s*\)/);
});

test("NodeContextMenu implements Variant B sections and API mutations", () => {
  const source = readUi("nodes/NodeContextMenu.tsx");
  for (const label of ["Plan", "Run", "Graph", "Advanced"]) {
    assert.match(source, new RegExp(label));
  }
  for (const path of [
    "/plan",
    "/breakdown",
    "/extend-budget",
    "/approve",
    "/skip",
    "/connect",
    "/delete",
  ]) {
    assert.match(source, new RegExp(path));
  }
  assert.match(source, /\/api\/nodes\/add/);
  assert.match(source, /Expert overrides/);
});

test("ExecutionNodeCard exposes context menu via right-click, ⋮, and keyboard", () => {
  const source = readUi("nodes/ExecutionNodeCard.tsx");
  assert.match(source, /onContextMenu/);
  assert.match(source, /node-actions-trigger/);
  assert.match(source, /ContextMenu|F10/);
  assert.match(source, /NodeContextMenu/);
  assert.match(source, /btn-primary-plan/);
  assert.match(source, /Plan children/);
  assert.doesNotMatch(source, /\/breakdown/);
  assert.doesNotMatch(source, /\/extend-budget/);
});

test("AppShell workflow mode excludes AdvancedHub and domain panels", () => {
  const source = readUi("app/AppShell.tsx");
  assert.match(source, /viewMode === "workflow"/);
  assert.match(source, /RunPanel/);
  assert.match(source, /AdvancedHub/);
  const workflowBlock = source.slice(
    source.indexOf('viewMode === "workflow"'),
    source.indexOf('viewMode === "workflow"') + 1200,
  );
  assert.doesNotMatch(workflowBlock, /AdvancedHub/);
  assert.doesNotMatch(workflowBlock, /ModelsView/);
  assert.doesNotMatch(workflowBlock, /PluginsView/);
});

test("AppShell refreshes node UI data when planning and selection state changes", () => {
  const source = readUi("app/AppShell.tsx");
  assert.match(source, /nodeUiStateKey/);
  assert.match(source, /planningNodeId/);
  assert.match(source, /planningError/);
  assert.match(source, /selectedNodeId/);
  assert.doesNotMatch(
    source,
    /const key = JSON\.stringify\(\{ nodes: snapshot\.graph\.nodes, edges: snapshot\.graph\.edges \}\)/,
  );
});

test("main.tsx is thin entry mounting AppShell only", () => {
  const source = readFileSync(join(UI_ROOT, "main.tsx"), "utf8");
  assert.match(source, /AppShell/);
  assert.doesNotMatch(source, /legacy\/panels/);
  assert.doesNotMatch(source, /ModelsView/);
});
