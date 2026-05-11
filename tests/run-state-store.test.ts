import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import { FileRunStateStore } from "../src/adapters/file-run-state-store.js";
import { createMutationAuditEvent } from "../src/application/runtime-events.js";

test("file run-state store enforces token + etag and records accepted/rejected mutations", async () => {
  const dir = await mkdtemp(join(tmpdir(), "rlm-runstate-"));
  try {
    const store = new FileRunStateStore({ baseDir: dir, now: () => "2026-05-11T00:00:00.000Z" });
    const run = await store.createRun("run-1", { metadata: { title: "demo" } });
    assert.equal(run.version, 1);

    await store.registerCapabilityToken("run-1", "executor", "tok-1");

    const missingToken = await store.mutate("run-1", {
      actor: "executor",
      path: "metadata.stage",
      action: "set",
      expectedVersion: 1,
      value: "wave-1",
    });
    assert.equal(missingToken.accepted, false);
    assert.match(missingToken.reason, /missing capability token/);

    const accepted = await store.mutate("run-1", {
      actor: "executor",
      path: "metadata.stage",
      action: "set",
      expectedVersion: 1,
      value: "wave-1",
      capabilityToken: "tok-1",
    });
    assert.equal(accepted.accepted, true);
    assert.equal(accepted.nextVersion, 2);

    const stale = await store.mutate("run-1", {
      actor: "executor",
      path: "metadata.stage",
      action: "set",
      expectedVersion: 1,
      value: "wave-2",
      capabilityToken: "tok-1",
    });
    assert.equal(stale.accepted, false);
    assert.match(stale.reason, /etag\/version conflict/);

    const replay = await store.buildOperationalReplay("run-1");
    assert.equal(replay.length, 3);
    assert.equal(replay[0]?.accepted, false);
    assert.equal(replay[1]?.accepted, true);
    assert.equal(replay[2]?.accepted, false);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("mutation audit event encodes required metadata", () => {
  const event = createMutationAuditEvent({
    runId: "run-1",
    seq: 3,
    actor: "executor",
    path: "metadata.stage",
    action: "set",
    accepted: false,
    reason: "etag/version conflict",
    occurredAt: "2026-05-11T00:00:00.000Z",
  });

  assert.equal(event.code, "RUN_STATE_MUTATION");
  assert.equal(event.source, "run-state");
  assert.equal(event.severity, "warn");
  assert.equal(event.seq, 3);
  assert.match(event.message, /rejected set on metadata\.stage/);
});

