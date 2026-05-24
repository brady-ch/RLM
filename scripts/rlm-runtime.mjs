#!/usr/bin/env node
/**
 * RLM runtime dispatcher — Rust-only CLI (Phase 115).
 *
 * Sole path: cargo-built rlm binary (release preferred, debug fallback).
 * RLM_RUNTIME env is ignored with a stderr warning if set (stale shell env).
 *
 * Usage: node scripts/rlm-runtime.mjs [rlm args...]
 */

import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const forwarded = process.argv.slice(2);

if (process.env.RLM_RUNTIME?.trim()) {
  console.error(
    `RLM_RUNTIME="${process.env.RLM_RUNTIME}" is ignored — Rust CLI is the sole runtime (Phase 115).`,
  );
}

function resolveRustBinary() {
  const binaryName = process.platform === "win32" ? "rlm.exe" : "rlm";
  const release = join(ROOT, "target", "release", binaryName);
  const debug = join(ROOT, "target", "debug", binaryName);
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

runRust();
