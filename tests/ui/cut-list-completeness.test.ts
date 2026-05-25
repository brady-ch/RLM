import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import test from "node:test";

const REPO_ROOT = process.cwd();
const CUT_LIST_PATH = join(
  REPO_ROOT,
  ".planning/phases/121-ui-vision-audit-and-cut-list/121-CUT-LIST.md",
);
const UI_ROOT = join(REPO_ROOT, "ui/src");

const EXCLUDED_TSX = new Set(["main.tsx", "shared/ThemeToggle.tsx"]);

const MANDATORY_SURFACES = [
  "RefineGraphPanel",
  "QualityLoopInspector",
  "NodeInspector",
  "WorkflowOverview",
  "GraphWorkflowPanel",
  "AppShell",
  "styles.css",
];

function listTsxFiles(dir: string): string[] {
  const entries = readdirSync(dir);
  const files: string[] = [];
  for (const entry of entries) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      files.push(...listTsxFiles(full));
    } else if (entry.endsWith(".tsx")) {
      files.push(full);
    }
  }
  return files;
}

function auditableTsxPaths(): string[] {
  return listTsxFiles(UI_ROOT)
    .map((full) => relative(UI_ROOT, full))
    .filter((rel) => !EXCLUDED_TSX.has(rel) && !EXCLUDED_TSX.has(rel.split("/").pop() ?? ""))
    .sort();
}

test("121-CUT-LIST.md covers every auditable ui/src tsx file", () => {
  const cutList = readFileSync(CUT_LIST_PATH, "utf8");

  assert.match(cutList, /audit-only/i, "cut list must state audit-only scope");

  for (const surface of MANDATORY_SURFACES) {
    assert.match(cutList, new RegExp(surface), `cut list must mention ${surface}`);
  }

  for (const relPath of auditableTsxPaths()) {
    const basename = relPath.split("/").pop() ?? relPath;
    assert.match(
      cutList,
      new RegExp(basename.replace(".", "\\.")),
      `cut list must include auditable file ${relPath}`,
    );
  }

  const verdictRows = cutList.match(/\| (Keep|Demote|Delete) \|/g) ?? [];
  assert.ok(
    verdictRows.length >= 26,
    `expected at least 26 verdict rows, found ${verdictRows.length}`,
  );
});
