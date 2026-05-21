import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { FileMemoryStore } from "../src/adapters/file-memory-store.js";
import { FileVectorIndex } from "../src/adapters/file-vector-index.js";
import { MemoryResolver } from "../src/application/memory-resolver.js";
import { SemanticMemoryIndex } from "../src/application/semantic-memory-index.js";
import type { EmbeddingPort } from "../src/ports/embedding-port.js";

class KeywordEmbedding implements EmbeddingPort {
  async embed(input: string): Promise<number[]> {
    const text = input.toLowerCase();
    return [
      text.includes("typescript") ? 1 : 0,
      text.includes("memory") ? 1 : 0,
      text.includes("release") ? 1 : 0,
    ];
  }
}

class FailingEmbedding implements EmbeddingPort {
  async embed(): Promise<number[]> {
    throw new Error("embedding provider unavailable");
  }
}

test("file memory store enforces scope ACLs and version conflicts", async () => {
  const dir = await mkdtemp(join(tmpdir(), "rlm-memory-"));
  try {
    const store = new FileMemoryStore({ baseDir: dir, now: () => "2026-05-20T00:00:00.000Z" });
    const first = await store.patchScope({
      sessionId: "run-1",
      scopeId: "project-facts",
      actor: "node-a",
      expectedVersion: 0,
      allowedScopes: ["project-facts"],
      writes: ["memory updates"],
      patch: { language: "TypeScript" },
      lifetime: "project",
    });

    assert.equal(first.accepted, true);
    assert.equal(first.nextVersion, 1);
    assert.deepEqual(await store.readScope("run-1", "project-facts"), {
      sessionId: "run-1",
      scopeId: "project-facts",
      lifetime: "project",
      version: 1,
      content: { language: "TypeScript" },
      updatedAt: "2026-05-20T00:00:00.000Z",
    });

    const conflict = await store.patchScope({
      sessionId: "run-1",
      scopeId: "project-facts",
      actor: "node-b",
      expectedVersion: 0,
      allowedScopes: ["project-facts"],
      writes: ["memory updates"],
      patch: { runtime: "node" },
    });
    assert.equal(conflict.accepted, false);
    assert.equal(conflict.reason, "etag/version conflict");

    const denied = await store.patchScope({
      sessionId: "run-1",
      scopeId: "private",
      actor: "node-c",
      expectedVersion: 0,
      allowedScopes: ["project-facts"],
      writes: ["memory updates"],
      patch: { secret: true },
    });
    assert.equal(denied.accepted, false);
    assert.equal(denied.reason, "memory scope ACL denied");

    const audit = await store.listAudit("run-1");
    assert.deepEqual(audit.map((record) => record.accepted), [true, false, false]);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("memory resolver builds bounded packets and records metadata", async () => {
  const dir = await mkdtemp(join(tmpdir(), "rlm-memory-"));
  try {
    const store = new FileMemoryStore({ baseDir: dir, now: () => "2026-05-20T00:00:00.000Z" });
    await store.patchScope({
      sessionId: "run-2",
      scopeId: "project-facts",
      actor: "setup",
      expectedVersion: 0,
      allowedScopes: ["project-facts"],
      writes: ["memory updates"],
      patch: { goal: "persist structured memory" },
    });

    const resolver = new MemoryResolver(store, { sessionId: "run-2", now: () => "2026-05-20T00:00:01.000Z" });
    await resolver.appendNodeSummary({
      nodeId: "task-1",
      summary: "Implemented the scope document store.",
      scopeIds: ["project-facts"],
    });
    const packet = await resolver.buildPacket({
      nodeId: "task-2",
      prompt: "persist memory",
      policy: {
        reads: ["rolling summary"],
        writes: ["memory updates"],
        limits: ["1200 characters"],
        memoryScopes: ["project-facts"],
      },
    });

    assert.ok(packet);
    assert.match(packet.text, /<memory_context>/);
    assert.match(packet.text, /persist structured memory/);
    assert.match(packet.text, /Implemented the scope document store/);
    assert.equal(packet.metadata.degraded, false);
    assert.equal(packet.metadata.truncated, false);

    const recorded = await store.getLastPacketMetadata("run-2", "task-2");
    assert.equal(recorded?.charsUsed, packet.metadata.charsUsed);
    assert.deepEqual(recorded?.scopeIds, ["project-facts"]);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("project preferences survive across run ids and can be deleted", async () => {
  const dir = await mkdtemp(join(tmpdir(), "rlm-memory-"));
  try {
    const store = new FileMemoryStore({ baseDir: dir, now: () => "2026-05-20T00:00:00.000Z" });
    const firstResolver = new MemoryResolver(store, { sessionId: "run-a", now: () => "2026-05-20T00:00:00.000Z" });
    await firstResolver.setPreference({
      key: "tone",
      value: "be direct",
      source: "test",
      lifetime: "project",
    });

    const secondResolver = new MemoryResolver(store, { sessionId: "run-b", now: () => "2026-05-20T00:00:01.000Z" });
    const beforeDelete = await secondResolver.inspect();
    const scope = beforeDelete.scopes.find((item) => item.scopeId === "project-preferences");
    assert.equal(scope?.lifetime, "project");
    assert.deepEqual(scope?.content["tone"], {
      value: "be direct",
      source: "test",
      updatedAt: "2026-05-20T00:00:00.000Z",
    });

    await secondResolver.deletePreference({ key: "tone" });
    const afterDelete = await firstResolver.inspect();
    const updatedScope = afterDelete.scopes.find((item) => item.scopeId === "project-preferences");
    assert.equal(updatedScope?.content["tone"], undefined);
    assert.equal(updatedScope?.version, 2);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("semantic memory retrieval injects scoped vector hits", async () => {
  const dir = await mkdtemp(join(tmpdir(), "rlm-memory-"));
  try {
    const store = new FileMemoryStore({ baseDir: dir, now: () => "2026-05-20T00:00:00.000Z" });
    await store.patchScope({
      sessionId: "run-3",
      scopeId: "project-facts",
      actor: "setup",
      expectedVersion: 0,
      allowedScopes: ["project-facts"],
      writes: ["memory updates"],
      patch: { fact: "TypeScript memory resolver" },
    });
    await store.patchScope({
      sessionId: "run-3",
      scopeId: "private",
      actor: "setup",
      expectedVersion: 0,
      allowedScopes: ["private"],
      writes: ["memory updates"],
      patch: { fact: "release packaging" },
    });
    const retrieval = new SemanticMemoryIndex({
      sessionId: "run-3",
      store,
      embeddings: new KeywordEmbedding(),
      index: new FileVectorIndex({ path: join(dir, "vector-index.json") }),
      now: () => "2026-05-20T00:00:01.000Z",
    });
    await retrieval.rebuild();
    const resolver = new MemoryResolver(store, { sessionId: "run-3", now: () => "2026-05-20T00:00:02.000Z" }, retrieval);

    const packet = await resolver.buildPacket({
      nodeId: "task-9",
      prompt: "Use TypeScript memory",
      policy: {
        reads: ["relevant memory entries"],
        writes: ["memory updates"],
        limits: ["2000 characters"],
        memoryScopes: ["project-facts"],
      },
    });

    assert.ok(packet);
    assert.match(packet.text, /Retrieval hits/);
    assert.match(packet.text, /TypeScript memory resolver/);
    assert.doesNotMatch(packet.text, /release packaging/);
    assert.equal(packet.metadata.retrievalHits?.[0]?.scopeId, "project-facts");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("semantic retrieval degrades visibly when embeddings fail", async () => {
  const dir = await mkdtemp(join(tmpdir(), "rlm-memory-"));
  try {
    const store = new FileMemoryStore({ baseDir: dir, now: () => "2026-05-20T00:00:00.000Z" });
    await store.patchScope({
      sessionId: "run-4",
      scopeId: "project-facts",
      actor: "setup",
      expectedVersion: 0,
      allowedScopes: ["project-facts"],
      writes: ["memory updates"],
      patch: { fact: "memory survives retrieval failure" },
    });
    const vectorIndex = new FileVectorIndex({ path: join(dir, "vector-index.json") });
    await vectorIndex.replace([{
      id: "scope:session:project-facts",
      sessionId: "run-4",
      scopeId: "project-facts",
      source: "scope",
      text: "Scope project-facts: {\"fact\":\"memory survives retrieval failure\"}",
      embedding: [1, 0, 0],
      updatedAt: "2026-05-20T00:00:00.000Z",
    }]);
    const retrieval = new SemanticMemoryIndex({
      sessionId: "run-4",
      store,
      embeddings: new FailingEmbedding(),
      index: vectorIndex,
    });
    const resolver = new MemoryResolver(store, { sessionId: "run-4", now: () => "2026-05-20T00:00:00.000Z" }, retrieval);

    const packet = await resolver.buildPacket({
      nodeId: "task-degraded",
      prompt: "memory",
      policy: {
        reads: ["relevant memory entries"],
        writes: ["memory updates"],
        limits: ["2000 characters"],
        memoryScopes: ["project-facts"],
      },
    });

    assert.ok(packet);
    assert.equal(packet.metadata.degraded, true);
    assert.match(packet.metadata.reasons.join("\n"), /embedding provider unavailable/);
    assert.match(packet.text, /memory survives retrieval failure/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
