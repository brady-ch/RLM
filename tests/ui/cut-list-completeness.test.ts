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
const STYLES_PATH = join(UI_ROOT, "styles.css");

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

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

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
    .filter((rel) => !EXCLUDED_TSX.has(rel))
    .sort();
}

function verdictTableSection(cutList: string): string {
  const start = cutList.indexOf("## Verdict table");
  const end = cutList.indexOf("## Summary");
  assert.ok(start >= 0 && end > start, "cut list must contain verdict table and summary sections");
  return cutList.slice(start, end);
}

test("121-CUT-LIST.md covers every auditable ui/src tsx file", () => {
  const cutList = readFileSync(CUT_LIST_PATH, "utf8");

  assert.match(cutList, /audit-only/i, "cut list must state audit-only scope");
  assert.ok(statSync(STYLES_PATH).isFile(), "ui/src/styles.css must exist for audit inventory");

  for (const surface of MANDATORY_SURFACES) {
    assert.match(cutList, new RegExp(escapeRegExp(surface)), `cut list must mention ${surface}`);
  }

  const verdictSection = verdictTableSection(cutList);
  const auditablePaths = auditableTsxPaths();

  for (const relPath of auditablePaths) {
    const pathNeedle = `ui/src/${relPath}`;
    assert.match(
      verdictSection,
      new RegExp(escapeRegExp(pathNeedle)),
      `verdict table must include row for ${pathNeedle}`,
    );
  }

  assert.match(
    verdictSection,
    /ui\/src\/styles\.css/,
    "verdict table must include styles.css row",
  );

  const expectedRows = auditablePaths.length + 1;
  const verdictRows = verdictSection.match(/\| (Keep|Demote|Delete) \|/g) ?? [];
  assert.ok(
    verdictRows.length >= expectedRows,
    `expected at least ${expectedRows} verdict rows in verdict table, found ${verdictRows.length}`,
  );
});
