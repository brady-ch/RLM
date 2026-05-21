import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { FileMemoryStore } from "../src/adapters/file-memory-store.js";
import { MemoryResolver } from "../src/application/memory-resolver.js";

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
