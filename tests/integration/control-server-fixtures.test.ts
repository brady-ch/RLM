import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import test from "node:test";

import { createInteractiveExecutionSession } from "../../src/application/execution-controller.js";
import { startControlServer } from "../../src/application/control-server/index.js";
import type { LanguageModelPort } from "../../src/ports/language-model-port.js";

const FIXTURE_DIR = resolve("tests/fixtures/control-server");

/** Routes backed by static handler responses — both runtimes must match golden JSON. */
const STATIC_ROUTES = [
  { path: "/api/saved-sessions", fixture: "saved-sessions-unconfigured.json", status: 404 },
  { path: "/api/memory", fixture: "memory-unconfigured.json", status: 404 },
  { path: "/api/graph-workflows", fixture: "graph-workflows-empty.json", status: 200 },
  { path: "/api/model-library", fixture: "model-library-unconfigured.json", status: 404 },
];

function loadFixture(name: string) {
  const raw = readFileSync(join(FIXTURE_DIR, name), "utf8");
  return JSON.parse(raw);
}

const stubPlanModel: LanguageModelPort = {
  complete: async () => ({ content: "", toolCalls: [] }),
};

test("TypeScript control server matches golden fixtures on static routes", async () => {
  const session = createInteractiveExecutionSession({
    seedRootPrompt: "",
    planModel: stubPlanModel,
  });

  const server = await startControlServer({
    session,
    port: 0,
    projectRoot: process.cwd(),
  });

  try {
    for (const route of STATIC_ROUTES) {
      const response = await fetch(`${server.url}${route.path}`);
      const body = await response.json();
      assert.equal(response.status, route.status, `${route.path} status mismatch`);
      assert.deepEqual(body, loadFixture(route.fixture), `${route.path} body mismatch`);
    }
  } finally {
    await server.close();
  }
});

test("golden fixture catalog is non-empty", () => {
  const names = readdirSync(FIXTURE_DIR).filter((name) => name.endsWith(".json"));
  assert.ok(names.length >= STATIC_ROUTES.length);
});
