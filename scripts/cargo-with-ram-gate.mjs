#!/usr/bin/env node
/**
 * Wrap cargo (or any shell command) with an adaptive RAM gate.
 *
 * Usage:
 *   node scripts/cargo-with-ram-gate.mjs [--tier compile|build|minimal] -- cargo test -p rlm-core
 */
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  formatRamGateSummary,
  ramLimitedEnv,
  requireRamGate,
  resolveRamLimits,
} from "./lib/ram-gate.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const sep = args.indexOf("--");
const flagArgs = sep >= 0 ? args.slice(0, sep) : args;
const cmdArgs = sep >= 0 ? args.slice(sep + 1) : [];

const tierIdx = flagArgs.indexOf("--tier");
const tier =
  tierIdx >= 0 && flagArgs[tierIdx + 1] ? flagArgs[tierIdx + 1] : "compile";

if (cmdArgs.length === 0) {
  console.error("Usage: node scripts/cargo-with-ram-gate.mjs [--tier compile] -- <command...>");
  process.exit(2);
}

const limits = resolveRamLimits();
const label = cmdArgs.join(" ");

console.log("[ram-gate] preflight");
console.log(formatRamGateSummary(limits));

if (!requireRamGate({ tier, label })) {
  process.exit(1);
}

const result = spawnSync(cmdArgs[0], cmdArgs.slice(1), {
  cwd: ROOT,
  env: { ...process.env, ...ramLimitedEnv(limits) },
  stdio: "inherit",
  shell: false,
});

process.exit(result.status ?? 1);
