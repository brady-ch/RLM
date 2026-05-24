#!/usr/bin/env node
/**
 * RLM runtime dispatcher — selects Node or Rust CLI based on RLM_RUNTIME.
 *
 *   RLM_RUNTIME=rust  (default) — cargo-built rlm binary (release preferred)
 *   RLM_RUNTIME=node            — Node dist/src/index.js (escape hatch until Phase 115)
 *
 * Usage: node scripts/rlm-runtime.mjs [rlm args...]
 */

import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const runtime = (process.env.RLM_RUNTIME ?? "rust").toLowerCase();
const forwarded = process.argv.slice(2);

function runNode() {
  const entry = join(ROOT, "dist", "src", "index.js");
  if (!existsSync(entry)) {
    console.error("Node CLI entry missing. Run `npm run build` first.");
    process.exit(1);
  }
  const result = spawnSync(process.execPath, [entry, ...forwarded], {
    cwd: process.cwd(),
    stdio: "inherit",
    env: process.env,
  });
  process.exit(result.status ?? 1);
}

function resolveRustBinary() {
  const release = join(ROOT, "target", "release", "rlm");
  const debug = join(ROOT, "target", "debug", "rlm");
  if (existsSync(release)) {
    return release;
  }
  if (existsSync(debug)) {
    return debug;
  }
  return null;
}

function runRust() {
  let binary = resolveRustBinary();
  if (!binary) {
    const build = spawnSync("cargo", ["build", "-p", "rlm-cli"], {
      cwd: ROOT,
      stdio: "inherit",
    });
    if (build.status !== 0) {
      process.exit(build.status ?? 1);
    }
    binary = resolveRustBinary();
  }
  if (!binary) {
    console.error("Rust rlm binary not found after build.");
    process.exit(1);
  }
  const result = spawnSync(binary, forwarded, {
    cwd: process.cwd(),
    stdio: "inherit",
    env: process.env,
  });
  process.exit(result.status ?? 1);
}

if (runtime === "rust") {
  runRust();
} else if (runtime === "node") {
  runNode();
} else {
  console.error(`Unknown RLM_RUNTIME="${process.env.RLM_RUNTIME}". Use node or rust.`);
  process.exit(1);
}
