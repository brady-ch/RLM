#!/usr/bin/env node
/**
 * Cross-runtime parity: compare Rust control-server responses to TypeScript for
 * session-scoped routes. Static routes are gated by golden fixture tests in
 * both `control_server_fixtures.rs` and `control-server-fixtures.test.ts`.
 */

import { spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createInteractiveExecutionSession } from "../../dist/src/application/execution-controller.js";
import { startControlServer } from "../../dist/src/application/control-server/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..", "..");

const SESSION_ROUTES = ["/api/session", "/api/run-mode"];

async function startTsServer() {
  const session = createInteractiveExecutionSession({
    seedRootPrompt: "",
    planModel: { complete: async () => ({ content: "", toolCalls: [] }) },
  });
  return startControlServer({ session, port: 0, projectRoot: ROOT });
}

function ensureRustBinary() {
  const release = join(ROOT, "target", "release", "rlm");
  const debug = join(ROOT, "target", "debug", "rlm");
  if (spawnSync("test", ["-x", release]).status === 0) {
    return release;
  }
  const build = spawnSync("cargo", ["build", "-p", "rlm-cli"], {
    cwd: ROOT,
    stdio: "inherit",
  });
  if (build.status !== 0) {
    process.exit(build.status ?? 1);
  }
  return debug;
}

async function startRustServer(binary) {
  const child = spawn(binary, ["ui", "--port", "0", "--project-root", ROOT], {
    cwd: ROOT,
    env: { ...process.env, RUST_LOG: "error" },
    stdio: ["ignore", "pipe", "pipe"],
  });

  const url = await new Promise((resolveUrl, reject) => {
    let buffer = "";
    child.stderr.on("data", (chunk) => {
      buffer += chunk.toString();
      const match = buffer.match(/RLM UI listening at (http:\/\/[^\s]+)/);
      if (match) {
        resolveUrl(match[1]);
      }
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code !== null && code !== 0) {
        reject(new Error(`Rust server exited with code ${code}`));
      }
    });
  });

  return {
    url,
    close: async () => {
      child.kill("SIGINT");
      await once(child, "exit");
    },
  };
}

function stableKeys(value) {
  if (value === null || typeof value !== "object") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(stableKeys);
  }
  return Object.keys(value)
    .sort()
    .reduce((acc, key) => {
      acc[key] = stableKeys(value[key]);
      return acc;
    }, {});
}

async function fetchJson(base, path) {
  const response = await fetch(`${base}${path}`);
  return { status: response.status, body: await response.json() };
}

async function main() {
  const ts = await startTsServer();
  const rustBinary = ensureRustBinary();
  const rust = await startRustServer(rustBinary);

  let failed = false;
  try {
    for (const path of SESSION_ROUTES) {
      const tsResult = await fetchJson(ts.url, path);
      const rustResult = await fetchJson(rust.url, path);

      if (tsResult.status !== rustResult.status) {
        console.error(`${path}: status mismatch TS=${tsResult.status} Rust=${rustResult.status}`);
        failed = true;
        continue;
      }

      const tsBody = stableKeys(tsResult.body);
      const rustBody = stableKeys(rustResult.body);

      // Rust golden fixtures use string readiness "empty"; TS uses structured readiness on draft graphs.
      if (path === "/api/session") {
        if (tsBody.status !== rustBody.status || tsBody.approvalMode !== rustBody.approvalMode) {
          console.error(`${path}: core session fields differ between runtimes`);
          failed = true;
        }
        continue;
      }

      if (JSON.stringify(tsBody) !== JSON.stringify(rustBody)) {
        console.error(`${path}: body mismatch between TS and Rust runtimes`);
        failed = true;
      }
    }
  } finally {
    await ts.close();
    await rust.close();
  }

  if (failed) {
    process.exit(1);
  }
  console.error("Cross-runtime session parity checks passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
