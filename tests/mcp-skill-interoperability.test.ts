import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import {
  CentralAtomicSequenceAllocator,
  CompositeEventSink,
  EventStoreSink,
  FileEventExportSink,
  InMemoryEventStore,
  McpSkillRuntime,
} from "../src/application/mcp-skill-runtime.js";

test("skill resolution uses search-path order and lenient parse warnings", async () => {
  const store = new InMemoryEventStore();
  const runtime = new McpSkillRuntime(
    {
      mcp: { servers: [] },
      skills: {
        searchPaths: ["/a", "/b"],
        duplicateStrategy: "first_match",
        cache: true,
        pathPolicies: [{ path: "/a", strictness: "lenient" }],
      },
    },
    "run-1",
    new CentralAtomicSequenceAllocator(),
    new EventStoreSink(store),
    () => 1_000,
  );

  const resolved = await runtime.resolveSkill("narrate", [
    { name: "narrate", absolutePath: "/a/narrate/SKILL.md", valid: false, reason: "bad format" },
    { name: "narrate", absolutePath: "/b/narrate/SKILL.md", valid: true },
  ]);

  assert.ok(resolved);
  assert.equal(resolved.candidate.absolutePath, "/b/narrate/SKILL.md");
  assert.equal(store.events.length, 1);
  assert.equal(store.events[0]?.code, "SKILL_PARSE_ERROR");
  assert.equal(store.events[0]?.severity, "warn");
});

test("strict skill path throws on invalid skill", async () => {
  const store = new InMemoryEventStore();
  const runtime = new McpSkillRuntime(
    {
      mcp: { servers: [] },
      skills: {
        searchPaths: ["/strict"],
        duplicateStrategy: "first_match",
        cache: false,
        pathPolicies: [{ path: "/strict", strictness: "strict" }],
      },
    },
    "run-2",
    new CentralAtomicSequenceAllocator(),
    new EventStoreSink(store),
    () => 1_000,
  );

  await assert.rejects(
    () => runtime.resolveSkill("parse", [{ name: "parse", absolutePath: "/strict/parse/SKILL.md", valid: false }]),
    /Skill parse error/,
  );
  assert.equal(store.events[0]?.severity, "error");
});

test("required and optional MCP disconnect policies pause", async () => {
  const store = new InMemoryEventStore();
  const runtime = new McpSkillRuntime(
    {
      mcp: {
        servers: [
          { id: "req", command: "x", required: true, args: [] },
          { id: "opt", command: "x", required: false, args: [] },
        ],
      },
      skills: {
        searchPaths: [],
        duplicateStrategy: "first_match",
        cache: false,
        pathPolicies: [],
      },
    },
    "run-3",
    new CentralAtomicSequenceAllocator(),
    new EventStoreSink(store),
    () => 1_000,
  );

  await runtime.markDisconnected("opt", "network", [], 0);
  await runtime.markDisconnected("req", "network", [], 0);
  assert.equal(runtime.shouldPauseForServer("opt"), true);
  assert.equal(runtime.shouldPauseForServer("req"), true);
  assert.equal(runtime.serverRequired("opt"), false);
  assert.equal(runtime.serverRequired("req"), true);
});

test("outage escalation emits warn then error and recovery emits verbose metrics", async () => {
  const store = new InMemoryEventStore();
  let now = 0;
  const runtime = new McpSkillRuntime(
    {
      mcp: { servers: [{ id: "req", command: "x", required: true, args: [] }] },
      skills: {
        searchPaths: [],
        duplicateStrategy: "first_match",
        cache: false,
        pathPolicies: [],
      },
    },
    "run-4",
    new CentralAtomicSequenceAllocator(),
    new EventStoreSink(store),
    () => now,
  );

  await runtime.markDisconnected("req", "store unavailable", [{ id: "n1", type: "mcp", model: "none" }], 2);
  now = 10_100;
  await runtime.tickOutage("req", [{ id: "n1", type: "mcp", model: "none" }], 2);
  now = 60_500;
  await runtime.tickOutage("req", [{ id: "n1", type: "mcp", model: "none" }], 2);
  now = 61_000;
  await runtime.markReconnected("req", [{ id: "n1", type: "mcp", model: "none" }], 1);

  const warn = store.events.find((event) => event.code === "MCP_OUTAGE_WARN");
  const err = store.events.find((event) => event.code === "MCP_OUTAGE_ERROR");
  const recovered = store.events.find((event) => event.code === "MCP_RECOVERED");
  assert.ok(warn);
  assert.ok(err);
  assert.ok(recovered);
  assert.ok(typeof recovered.metrics?.["outage_duration_ms"] === "number");
  assert.ok(typeof recovered.metrics?.["events_blocked_count"] === "number");
  assert.ok(typeof recovered.metrics?.["resume_seq"] === "number");
});

test("event sink can fan out to memory and file export", async () => {
  const dir = await mkdtemp(join(tmpdir(), "rlm-mcp-events-"));
  const store = new InMemoryEventStore();
  try {
    const sink = new CompositeEventSink([
      new EventStoreSink(store),
      new FileEventExportSink(join(dir, "warnings.jsonl")),
    ]);
    const runtime = new McpSkillRuntime(
      {
        mcp: { servers: [{ id: "x", command: "x", required: false, args: [] }] },
        skills: {
          searchPaths: [],
          duplicateStrategy: "first_match",
          cache: false,
          pathPolicies: [],
        },
      },
      "run-5",
      new CentralAtomicSequenceAllocator(),
      sink,
      () => 5_000,
    );

    await runtime.markDisconnected("x", "net", [], 0);
    assert.equal(store.events.length, 1);
    assert.ok(store.events[0]?.eventId);
    assert.ok(store.events[0]?.fingerprint);
    assert.equal(store.events[0]?.seq, 1);
    assert.equal(store.events[0]?.severity, "info");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
