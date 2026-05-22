import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import { FileSessionStore } from "../src/adapters/index.js";

test("file session store saves complete bundle with memory and vector contract sections", async () => {
  const dir = await mkdtemp(join(tmpdir(), "rlm-sessions-"));
  try {
    const store = new FileSessionStore({ baseDir: dir, now: () => "2026-05-21T00:00:00.000Z" });
    const saved = await store.save({
      id: "demo",
      name: "Demo",
      payload: {
        session: { graph: { nodes: [], edges: [] }, status: "planned" },
        artifacts: { refs: [] },
        memory: { status: "contract_saved", scopes: [] },
        preferences: { status: "contract_saved", preferences: [] },
        vectorIndex: { status: "not_indexed", rebuildNeeded: true },
      },
    });

    assert.equal(saved.status, "complete");
    assert.equal(saved.verification.unsafeToContinue, false);
    assert.deepEqual(saved.verification.missing, []);
    assert.ok(
      saved.verification.sections.some(
        (section) => section.name === "vectorIndex" && section.status === "complete",
      ),
    );

    const list = await store.list();
    assert.equal(list[0]?.id, "demo");
    assert.equal(list[0]?.status, "complete");

    const loaded = await store.load("demo");
    assert.deepEqual(loaded.payload.vectorIndex, { status: "not_indexed", rebuildNeeded: true });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("file session store reports corrupt section without deleting evidence", async () => {
  const dir = await mkdtemp(join(tmpdir(), "rlm-sessions-corrupt-"));
  try {
    const store = new FileSessionStore({ baseDir: dir, now: () => "2026-05-21T00:00:00.000Z" });
    await store.save({
      id: "demo",
      payload: {
        session: {},
        artifacts: {},
        memory: {},
        preferences: {},
        vectorIndex: {},
      },
    });
    await writeFile(join(dir, "demo", "memory.json"), "{not-json", "utf8");

    const verification = await store.inspect("demo");
    assert.equal(verification.status, "failed");
    assert.equal(verification.unsafeToContinue, true);
    assert.equal(verification.corrupt[0]?.section, "memory");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("file session store reports degraded restore when a section is missing", async () => {
  const dir = await mkdtemp(join(tmpdir(), "rlm-sessions-missing-"));
  try {
    const sessionDir = join(dir, "demo");
    await mkdir(sessionDir, { recursive: true });
    await writeFile(
      join(sessionDir, "manifest.json"),
      JSON.stringify({
        version: 1,
        id: "demo",
        name: "Demo",
        createdAt: "2026-05-21T00:00:00.000Z",
        updatedAt: "2026-05-21T00:00:00.000Z",
        sections: {
          session: { file: "session.json", version: 1 },
          runState: { file: "run-state.json", version: 1 },
          artifacts: { file: "artifacts.json", version: 1 },
          memory: { file: "memory.json", version: 1 },
          preferences: { file: "preferences.json", version: 1 },
          vectorIndex: { file: "vector-index.json", version: 1 },
          graphWorkflowMetadata: { file: "graph-workflow-metadata.json", version: 1 },
        },
      }),
      "utf8",
    );
    for (const file of [
      "session.json",
      "run-state.json",
      "artifacts.json",
      "preferences.json",
      "vector-index.json",
      "graph-workflow-metadata.json",
    ]) {
      await writeFile(join(sessionDir, file), JSON.stringify({ version: 1, data: {} }), "utf8");
    }

    const store = new FileSessionStore({ baseDir: dir });
    const verification = await store.inspect("demo");
    assert.equal(verification.status, "degraded");
    assert.deepEqual(verification.missing, ["memory"]);
    assert.equal(verification.unsafeToContinue, true);

    const loaded = await store.load("demo");
    assert.equal(loaded.verification.status, "degraded");
    assert.equal(loaded.payload.memory, null);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
