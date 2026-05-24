#!/usr/bin/env node
/**
 * Memory-safe sequential verification for autonomous agents.
 *
 * Every step checks MemAvailable before running (minimal / compile / build tiers).
 *
 * Usage:
 *   node scripts/agent-safe-verify.mjs [--profile light|reg01|reg03] [--strict]
 *
 * See scripts/lib/ram-gate.mjs for env overrides (RAM_GATE_*, AGENT_VERIFY_*).
 */

import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  formatRamGateSummary,
  gateMbForTier,
  ramLimitedEnv,
  readMemoryStats,
  requireRamGate,
  resolveRamLimits,
} from "./lib/ram-gate.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PRELOAD = "./scripts/test-ram-preload.mjs";
const RELAXED =
  process.argv.includes("--no-strict") || process.env.AGENT_VERIFY_STRICT === "0";

const args = process.argv.slice(2);
const profileIdx = args.indexOf("--profile");
const profile = profileIdx >= 0 ? args[profileIdx + 1] : "reg01";

/** @typedef {"minimal" | "compile" | "build"} RamGateTier */

/** @type {Record<string, { label: string; cmd: string; tier: RamGateTier }[]>} */
const PROFILES = {
  light: [
    {
      label: "cargo check (rlm-core, rlm-cli)",
      cmd: "cargo check -p rlm-cli -p rlm-core",
      tier: "compile",
    },
    {
      label: "rust config loader smoke",
      cmd: "node scripts/cargo-with-ram-gate.mjs -- cargo test -p rlm-core loader -- --nocapture",
      tier: "compile",
    },
    {
      label: "reg03 static wiring (tsx)",
      cmd: `node --import ${PRELOAD} --import tsx --test tests/ui/reg03-static-wiring.test.ts`,
      tier: "minimal",
    },
  ],
  reg01: [
    { label: "build UI (once)", cmd: "npm run build:ui", tier: "build" },
    { label: "lint ui/src", cmd: "npm run lint -- ui/src", tier: "minimal" },
    {
      label: "cargo check (rlm-core, rlm-cli)",
      cmd: "cargo check -p rlm-cli -p rlm-core",
      tier: "compile",
    },
    {
      label: "reg01 HTTP smoke",
      cmd: "cargo test -p rlm-core reg01_uat_smoke -- --nocapture",
      tier: "compile",
    },
    {
      label: "reg01 static wiring (tsx)",
      cmd: `node --import ${PRELOAD} --import tsx --test tests/ui/reg01-static-wiring.test.ts`,
      tier: "minimal",
    },
  ],
  reg03: [
    { label: "build UI (once)", cmd: "npm run build:ui", tier: "build" },
    { label: "lint ui/src", cmd: "npm run lint -- ui/src", tier: "minimal" },
    {
      label: "cargo check (rlm-core, rlm-cli)",
      cmd: "cargo check -p rlm-cli -p rlm-core",
      tier: "compile",
    },
    {
      label: "reg01 HTTP smoke",
      cmd: "cargo test -p rlm-core reg01_uat_smoke -- --nocapture",
      tier: "compile",
    },
    {
      label: "ram_guard unit tests",
      cmd: "cargo test -p rlm-core ram_guard -- --nocapture",
      tier: "compile",
    },
    {
      label: "chat_routes integration",
      cmd: "cargo test -p rlm-core --test chat_routes -- --nocapture",
      tier: "compile",
    },
    {
      label: "reg03 HTTP smoke",
      cmd: "cargo test -p rlm-core reg03_uat_smoke -- --nocapture",
      tier: "compile",
    },
    {
      label: "reg01 static wiring (tsx)",
      cmd: `node --import ${PRELOAD} --import tsx --test tests/ui/reg01-static-wiring.test.ts`,
      tier: "minimal",
    },
    {
      label: "reg03 static wiring (tsx)",
      cmd: `node --import ${PRELOAD} --import tsx --test tests/ui/reg03-static-wiring.test.ts`,
      tier: "minimal",
    },
    {
      label: "rust config loader smoke",
      cmd: "node scripts/cargo-with-ram-gate.mjs -- cargo test -p rlm-core loader -- --nocapture",
      tier: "compile",
    },
  ],
};

function dropCachesHint() {
  spawnSync("sync", { cwd: ROOT, stdio: "ignore" });
}

function runStep(step, index, total, limits) {
  console.log(`\n── Step ${index + 1}/${total}: ${step.label} ──`);
  console.log(`   MemAvailable: ${readMemoryStats().availableMb} MB`);
  console.log(`   Gate tier: ${step.tier} (${gateMbForTier(step.tier, limits)} MB required)`);

  if (
    !requireRamGate({
      tier: step.tier,
      label: step.label,
      strict: !RELAXED,
    })
  ) {
    console.error(`✗ Skipped (RAM gate): ${step.label}`);
    return false;
  }

  const started = Date.now();
  const result = spawnSync(step.cmd, {
    cwd: ROOT,
    env: { ...process.env, ...ramLimitedEnv(limits) },
    shell: true,
    stdio: "inherit",
  });
  const elapsed = ((Date.now() - started) / 1000).toFixed(1);

  if (result.status !== 0) {
    console.error(`✗ FAILED (${elapsed}s): ${step.label}`);
    return false;
  }

  console.log(`✓ PASS (${elapsed}s) — MemAvailable: ${readMemoryStats().availableMb} MB`);
  dropCachesHint();
  return true;
}

const steps = PROFILES[profile];
if (!steps) {
  console.error(`Unknown profile "${profile}". Use: ${Object.keys(PROFILES).join(", ")}`);
  process.exit(2);
}

function main() {
  const limits = resolveRamLimits();

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(" Agent-safe verify");
  console.log(` Profile: ${profile} (${steps.length} steps, sequential)`);
  console.log(formatRamGateSummary(limits));
  console.log(" Every step checks MemAvailable before running");
  if (RELAXED) {
    console.log(" Mode: relaxed (warn and continue — set RAM_GATE_STRICT=1 to block)");
  }
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  for (let i = 0; i < steps.length; i += 1) {
    if (!runStep(steps[i], i, steps.length, limits)) {
      process.exit(1);
    }
  }

  console.log("\n✓ Agent-safe verify complete");
}

const isMain =
  process.argv[1] &&
  resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));

if (isMain) {
  main();
}
