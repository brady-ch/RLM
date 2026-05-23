#!/usr/bin/env node
/**
 * Main test suite with RAM gates before every phase.
 * Replaces chained `npm run build && node --test ...` to prevent OOM.
 */
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  formatRamGateSummary,
  ramLimitedEnv,
  readMemoryStats,
  requireRamGate,
  resolveRamLimits,
} from "./lib/ram-gate.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PRELOAD = join(ROOT, "scripts/test-ram-preload.mjs");

/** @type {{ label: string; tier: "minimal" | "compile" | "build"; cmd: string[] }[]} */
const STEPS = [
  { label: "tsc build", tier: "compile", cmd: ["npm", "run", "build"] },
  {
    label: "node test suite",
    tier: "compile",
    cmd: ["node", "--import", PRELOAD, "--test", "dist/tests"],
  },
  {
    label: "packaging tests",
    tier: "minimal",
    cmd: ["npm", "run", "test:packaging"],
  },
];

function runStep(step, index, total, limits) {
  console.log(`\n── [${index + 1}/${total}] ${step.label} ──`);
  console.log(`   MemAvailable: ${readMemoryStats().availableMb} MB`);

  if (!requireRamGate({ tier: step.tier, label: step.label })) {
    console.error(`✗ RAM gate blocked: ${step.label}`);
    return false;
  }

  const started = Date.now();
  const result = spawnSync(step.cmd[0], step.cmd.slice(1), {
    cwd: ROOT,
    env: { ...process.env, ...ramLimitedEnv(limits) },
    stdio: "inherit",
    shell: false,
  });
  const elapsed = ((Date.now() - started) / 1000).toFixed(1);

  if (result.status !== 0) {
    console.error(`✗ FAILED (${elapsed}s): ${step.label}`);
    return false;
  }

  console.log(`✓ PASS (${elapsed}s) — MemAvailable: ${readMemoryStats().availableMb} MB`);
  return true;
}

const limits = resolveRamLimits();

console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log(" Test suite (RAM-gated)");
console.log(formatRamGateSummary(limits));
console.log(" Every step and each node:test case checks MemAvailable first");
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

for (let i = 0; i < STEPS.length; i += 1) {
  if (!runStep(STEPS[i], i, STEPS.length, limits)) {
    process.exit(1);
  }
}

console.log("\n✓ Test suite complete");
