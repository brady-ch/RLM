import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
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
import { createMcpTools, createSkillTool } from "../src/application/interop-runtime.js";

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
test("configured skill search paths expose an executable production skill tool", async () => {
  const dir = await mkdtemp(join(tmpdir(), "rlm-skills-"));
  const skillDir = join(dir, "summarize");
  try {
    await mkdir(skillDir, { recursive: true });
    await writeFile(
      join(skillDir, "SKILL.md"),
      "---\nname: summarize\ndescription: Summarize text\n---\nUse terse bullets.\n",
      "utf8",
    );
    const store = new InMemoryEventStore();
    const runtime = new McpSkillRuntime(
      {
        mcp: { servers: [] },
        skills: {
          searchPaths: [dir],
          duplicateStrategy: "first_match",
          cache: false,
          pathPolicies: [{ path: dir, strictness: "strict" }],
        },
      },
      "run-skill-tool",
      new CentralAtomicSequenceAllocator(),
      new EventStoreSink(store),
      () => 1_000,
    );

    const tool = createSkillTool(runtime);
    const result = await tool.execute({ name: "summarize" });

    assert.equal(result.status, "success");
    assert.match(result.output, /Use terse bullets/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("configured MCP server exposes framed stdio tools", async () => {
  const dir = await mkdtemp(join(tmpdir(), "rlm-mcp-server-"));
  const serverPath = join(dir, "server.mjs");
  try {
    await writeFile(serverPath, `
let buffer = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  buffer += chunk;
  for (;;) {
    const headerEnd = buffer.indexOf("\\r\\n\\r\\n");
    if (headerEnd < 0) return;
    const header = buffer.slice(0, headerEnd);
    const length = Number(header.match(/Content-Length:\\s*(\\d+)/i)?.[1] ?? "0");
    const bodyStart = headerEnd + 4;
    const bodyEnd = bodyStart + length;
    if (buffer.length < bodyEnd) return;
    const request = JSON.parse(buffer.slice(bodyStart, bodyEnd));
    buffer = buffer.slice(bodyEnd);
    if (request.id !== undefined) handle(request);
  }
});
function send(id, result) {
  const body = JSON.stringify({ jsonrpc: "2.0", id, result });
  process.stdout.write("Content-Length: " + Buffer.byteLength(body) + "\\r\\n\\r\\n" + body);
}
function handle(request) {
  if (request.method === "initialize") send(request.id, { capabilities: { tools: {} } });
  if (request.method === "tools/list") send(request.id, { tools: [{ name: "echo", description: "Echo", inputSchema: {} }] });
  if (request.method === "tools/call") send(request.id, { content: [{ type: "text", text: "mcp:" + request.params.arguments.text }] });
}
`, "utf8");
    const store = new InMemoryEventStore();
    const runtime = new McpSkillRuntime(
      {
        mcp: { servers: [{ id: "local", command: process.execPath, args: [serverPath], required: true }] },
        skills: {
          searchPaths: [],
          duplicateStrategy: "first_match",
          cache: false,
          pathPolicies: [],
        },
      },
      "run-mcp-tool",
      new CentralAtomicSequenceAllocator(),
      new EventStoreSink(store),
      () => 1_000,
    );
    const children: Array<{ kill(): boolean }> = [];
    const tools = await createMcpTools(
      [{ id: "local", command: process.execPath, args: [serverPath], required: true }],
      runtime,
      (child) => children.push(child),
    );
    try {
      const tool = tools.find((item) => item.name === "local.echo");
      assert.ok(tool);
      const result = await tool.execute({ text: "hello" });
      assert.deepEqual(result, { status: "success", output: "mcp:hello" });
    } finally {
      for (const child of children) {
        child.kill();
      }
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
