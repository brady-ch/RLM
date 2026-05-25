import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const UI_ROOT = join(process.cwd(), "ui/src");
const STYLES_DIR = join(UI_ROOT, "styles");

function readStyles(relativePath: string): string {
  return readFileSync(join(UI_ROOT, relativePath), "utf8");
}

function allStyleSources(): string {
  const modules = readdirSync(STYLES_DIR)
    .filter((f) => f.endsWith(".css"))
    .map((f) => readFileSync(join(STYLES_DIR, f), "utf8"));
  return [readStyles("styles.css"), ...modules].join("\n");
}

test("styles.css imports all concern modules", () => {
  const barrel = readStyles("styles.css");
  for (const mod of ["base", "canvas", "nodes", "workflow", "advanced"]) {
    assert.match(barrel, new RegExp(`@import "./styles/${mod}\\.css"`));
  }
  assert.match(barrel, /@import "\.\/shared\/tokens\.css"/);
});

test("canvas module preserves dot grid background", () => {
  const canvas = readFileSync(join(STYLES_DIR, "canvas.css"), "utf8");
  assert.match(canvas, /radial-gradient\(circle, var\(--color-canvas-dot\)/);
  assert.match(canvas, /background-size: 20px 20px/);
});

test("dead Phase 122-123 selectors absent from styles modules", () => {
  const css = allStyleSources();
  const dead = [
    "approval-mode-pill",
    "run-variant-pill",
    "workflow-overview",
    "run-panel-prompt",
    "run-panel-detail",
    "memory-budget-summary",
  ];
  for (const selector of dead) {
    assert.doesNotMatch(css, new RegExp(`\\.${selector}\\b`), `dead selector .${selector} still present`);
  }
});

test("live selectors retained in split modules", () => {
  const css = allStyleSources();
  assert.match(css, /\.run-variant-controls\b/);
  assert.match(css, /\.run-success-hint\b/);
  assert.match(css, /\.node-card\b/);
});
