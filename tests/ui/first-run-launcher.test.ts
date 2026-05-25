import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const UI_ROOT = join(process.cwd(), "ui/src");

function readUi(relativePath: string): string {
  return readFileSync(join(UI_ROOT, relativePath), "utf8");
}

test("FirstRunLauncher provides guided composer and session picker", () => {
  const source = readUi("app/FirstRunLauncher.tsx");
  assert.match(source, /data-testid="first-run-launcher"/);
  assert.match(source, /Guided composer/);
  assert.match(source, /Saved sessions/);
  assert.match(source, /Continue to graph/);
  assert.match(source, /Start fresh/);
  assert.match(source, /\/api\/saved-sessions/);
  assert.match(source, /\/api\/nodes\/root-composer\/edit/);
  assert.match(source, /\/api\/nodes\/root-composer\/plan/);
  assert.doesNotMatch(source, /from\s+['"][^'"]*advanced/);
});

test("session-utils detects pristine first-run graph", () => {
  const source = readUi("shared/session-utils.ts");
  assert.match(source, /isPristineFirstRunGraph/);
  assert.match(source, /root-composer/);
});

test("AppShell integrates launcher with workflow primary surface", () => {
  const shell = readUi("app/AppShell.tsx");
  const router = readUi("app/hooks/useViewRouter.ts");
  assert.match(shell, /FirstRunLauncher/);
  assert.match(shell, /showLauncher/);
  assert.match(shell, /TopBar/);
  assert.match(shell, /onAdvanced/);
  assert.match(router, /isPristineFirstRunGraph/);
  assert.match(router, /showLauncher/);
  const workflowBlock = shell.slice(
    shell.indexOf('viewMode === "workflow"'),
    shell.indexOf('viewMode === "workflow"') + 1800,
  );
  assert.doesNotMatch(workflowBlock, /AdvancedHub/);
});

test("launcher styles include overlay and composer layout", () => {
  const source = readUi("styles/workflow.css");
  assert.match(source, /\.first-run-overlay/);
  assert.match(source, /\.first-run-composer/);
  assert.match(source, /\.workflow-main-dimmed/);
});
