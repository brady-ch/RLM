import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import { FileMemoryStore } from "../src/adapters/file-memory-store.js";
import { FileVectorIndex, type VectorIndexRecord } from "../src/adapters/file-vector-index.js";
import { FileSessionStore } from "../src/adapters/file-session-store.js";
import {
  buildSavedSessionPayload,
  readRunIdFromPayload,
  restoreSessionMemory,
} from "../src/application/session-memory-bridge.js";
import { SemanticMemoryIndex } from "../src/application/semantic-memory-index.js";

class StubEmbeddings {
  async embed(text: string): Promise<number[]> {
    return [text.length, text.length % 7, 1];
  }
}

test("buildSavedSessionPayload exports live memory and vector records for runId", async () => {
  const dir = await mkdtemp(join(tmpdir(), "rlm-bridge-save-"));
  try {
    const memoryStore = new FileMemoryStore({
      baseDir: join(dir, "memory"),
      now: () => "2026-05-21T00:00:00.000Z",
    });
    const vectorIndex = new FileVectorIndex({ path: join(dir, "vector-index.json") });
    const runId = "run-save-test";
    await memoryStore.patchScope({
      sessionId: runId,
      scopeId: "notes",
      actor: "runtime",
      expectedVersion: 0,
      allowedScopes: ["notes"],
      writes: ["memory updates"],
      patch: { text: "remember this" },
      lifetime: "session",
    });
    await memoryStore.appendEpisodic({
      id: "ep-1",
      sessionId: runId,
      type: "summary",
      summary: "node finished",
      scopeIds: ["notes"],
      timestamp: "2026-05-21T00:00:00.000Z",
    });
    await vectorIndex.replace([
      {
        id: "scope:session:notes",
        sessionId: runId,
        scopeId: "notes",
        source: "scope",
        text: "Scope notes",
        embedding: [1, 2, 3],
        updatedAt: "2026-05-21T00:00:00.000Z",
      } satisfies VectorIndexRecord,
    ]);

    const payload = await buildSavedSessionPayload({
      snapshot: {
        graph: { nodes: [], edges: [], viewport: { x: 0, y: 0, zoom: 1 } },
        status: "planned",
        approvalMode: "full",
        autoApprovalPaused: false,
        chat: { readiness: { state: "draft", reason: "test" }, clarificationHistory: [] },
      },
      runId,
      memoryStore,
      vectorIndex,
      embedProvider: "stub",
    });

    assert.equal((payload.memory as { runId: string }).runId, runId);
    assert.ok((payload.memory as { episodic: unknown[] }).episodic.length >= 1);
    assert.equal((payload.vectorIndex as { records: unknown[] }).records.length, 1);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("restoreSessionMemory rebinds episodic data under saved runId", async () => {
  const dir = await mkdtemp(join(tmpdir(), "rlm-bridge-restore-"));
  try {
    const memoryStore = new FileMemoryStore({
      baseDir: join(dir, "memory"),
      now: () => "2026-05-21T00:00:00.000Z",
    });
    const vectorIndex = new FileVectorIndex({ path: join(dir, "vector-index.json") });
    const runId = "run-restore-test";
    const payload = await buildSavedSessionPayload({
      snapshot: {
        graph: { nodes: [], edges: [], viewport: { x: 0, y: 0, zoom: 1 } },
        status: "planned",
        approvalMode: "full",
        autoApprovalPaused: false,
        chat: { readiness: { state: "draft", reason: "test" }, clarificationHistory: [] },
      },
      runId,
      memoryStore,
      vectorIndex,
    });
    await memoryStore.restoreSessionData("other-run", {
      scopes: [],
      episodic: [],
      audit: [],
      packets: [],
    });

    const restoredRunId = await restoreSessionMemory({ payload, memoryStore, vectorIndex });
    assert.equal(restoredRunId, runId);
    const episodic = await memoryStore.listEpisodic(runId);
    assert.ok(episodic.length >= 0);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("readRunIdFromPayload prefers saved runId", () => {
  const runId = readRunIdFromPayload(
    {
      session: {},
      artifacts: {},
      memory: {
        version: 2,
        runId: "run-saved",
        status: "saved",
        scopes: [],
        episodic: [],
        audit: [],
        packets: [],
      },
      preferences: {},
      vectorIndex: {},
    },
    "run-fallback",
  );
  assert.equal(runId, "run-saved");
});

test("vector index merge preserves other session records", async () => {
  const dir = await mkdtemp(join(tmpdir(), "rlm-vector-merge-"));
  try {
    const vectorIndex = new FileVectorIndex({ path: join(dir, "vector-index.json") });
    await vectorIndex.replace([
      {
        id: "a",
        sessionId: "run-a",
        scopeId: "s1",
        source: "scope",
        text: "a",
        embedding: [1],
        updatedAt: "t",
      },
      {
        id: "b",
        sessionId: "run-b",
        scopeId: "s2",
        source: "scope",
        text: "b",
        embedding: [2],
        updatedAt: "t",
      },
    ]);
    await vectorIndex.mergeSessionRecords("run-a", [
      {
        id: "a2",
        sessionId: "run-a",
        scopeId: "s1",
        source: "scope",
        text: "a2",
        embedding: [3],
        updatedAt: "t",
      },
    ]);
    const records = await vectorIndex.read();
    assert.equal(records.filter((record) => record.sessionId === "run-a").length, 1);
    assert.equal(records.filter((record) => record.sessionId === "run-b").length, 1);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("semantic memory search does not synchronously rebuild on empty index", async () => {
  const dir = await mkdtemp(join(tmpdir(), "rlm-async-index-"));
  try {
    const memoryStore = new FileMemoryStore({ baseDir: join(dir, "memory") });
    const vectorIndex = new FileVectorIndex({ path: join(dir, "vector-index.json") });
    const index = new SemanticMemoryIndex({
      sessionId: "run-async",
      store: memoryStore,
      embeddings: new StubEmbeddings(),
      index: vectorIndex,
    });
    const started = Date.now();
    const result = await index.search({ query: "hello", scopeIds: ["notes"] });
    const elapsed = Date.now() - started;
    assert.equal(result.status, "empty");
    assert.ok(elapsed < 200, "search should return immediately without sync rebuild");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("saved session round trip through FileSessionStore keeps memory section", async () => {
  const dir = await mkdtemp(join(tmpdir(), "rlm-session-roundtrip-"));
  try {
    const memoryStore = new FileMemoryStore({
      baseDir: join(dir, "memory"),
      now: () => "2026-05-21T00:00:00.000Z",
    });
    const vectorIndex = new FileVectorIndex({ path: join(dir, "vector-index.json") });
    const sessionStore = new FileSessionStore({
      baseDir: join(dir, "sessions"),
      now: () => "2026-05-21T00:00:00.000Z",
    });
    const runId = "run-roundtrip";
    await memoryStore.appendEpisodic({
      id: "ep-round",
      sessionId: runId,
      type: "summary",
      summary: "saved summary",
      scopeIds: ["notes"],
      timestamp: "2026-05-21T00:00:00.000Z",
    });
    const payload = await buildSavedSessionPayload({
      snapshot: {
        graph: { nodes: [], edges: [], viewport: { x: 0, y: 0, zoom: 1 } },
        status: "planned",
        approvalMode: "full",
        autoApprovalPaused: false,
        chat: { readiness: { state: "draft", reason: "test" }, clarificationHistory: [] },
      },
      runId,
      memoryStore,
      vectorIndex,
    });
    const saved = await sessionStore.save({ id: "demo", payload });
    assert.equal(saved.status, "complete");
    const loaded = await sessionStore.load("demo");
    assert.equal(readRunIdFromPayload(loaded.payload, "fallback"), runId);
    assert.equal(
      (loaded.payload.memory as { episodic: Array<{ summary: string }> }).episodic[0]?.summary,
      "saved summary",
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
