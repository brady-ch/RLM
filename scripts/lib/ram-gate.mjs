/**
 * Adaptive RAM gates for test and build runners.
 *
 * Env:
 *   RAM_GATE_STRICT=1          Fail when gate not met (default for test wrappers)
 *   RAM_GATE_WAIT_SEC=30       Wait for memory before failing
 *   RAM_GATE_DISABLED=1        Skip all gates (escape hatch)
 *   AGENT_VERIFY_*             Legacy overrides (see agent-safe-verify.mjs)
 */

import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import os from "node:os";

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

/** @returns {{ totalMb: number; availableMb: number; source: string }} */
export function readMemoryStats() {
  try {
    const meminfo = readFileSync("/proc/meminfo", "utf8");
    const available = meminfo.match(/^MemAvailable:\s+(\d+)\s+kB/m);
    const total = meminfo.match(/^MemTotal:\s+(\d+)\s+kB/m);
    if (available && total) {
      return {
        totalMb: Math.floor(Number(total[1]) / 1024),
        availableMb: Math.floor(Number(available[1]) / 1024),
        source: "linux-memavailable",
      };
    }
  } catch {
    // fall through
  }

  return {
    totalMb: Math.floor(os.totalmem() / 1024 / 1024),
    availableMb: Math.floor(os.freemem() / 1024 / 1024),
    source: "os.freemem",
  };
}

/**
 * @param {{ totalMb: number; availableMb: number }} stats
 */
export function computeAdaptiveLimits(stats) {
  const { totalMb, availableMb } = stats;

  const minimalTarget = clamp(Math.round(totalMb * 0.04), 192, 768);
  const buildTarget = clamp(Math.round(totalMb * 0.1), 512, 3072);
  const compileTarget = clamp(Math.round(totalMb * 0.07), 384, 2048);

  const minimalGateMb = Math.min(
    minimalTarget,
    Math.max(128, Math.round(availableMb * 0.15)),
  );
  const buildGateMb = Math.min(
    buildTarget,
    Math.max(384, Math.round(availableMb * 0.4)),
  );
  const compileGateMb = Math.min(
    compileTarget,
    Math.max(256, Math.round(availableMb * 0.3)),
  );

  const nodeHeapMb = Math.min(
    clamp(Math.round(totalMb * 0.12), 1024, 8192),
    Math.max(768, Math.round(availableMb * 0.45)),
  );

  let cargoJobs = 1;
  if (totalMb >= 24 * 1024 && availableMb >= 6144) {
    cargoJobs = 4;
  } else if (totalMb >= 16 * 1024 && availableMb >= 4096) {
    cargoJobs = 2;
  } else if (totalMb >= 10 * 1024 && availableMb >= 2560) {
    cargoJobs = 2;
  }

  return {
    minimalGateMb,
    buildGateMb,
    compileGateMb,
    nodeHeapMb,
    cargoJobs,
  };
}

export function resolveRamLimits() {
  const stats = readMemoryStats();
  const adaptive = computeAdaptiveLimits(stats);

  const legacyMin = process.env.AGENT_VERIFY_MIN_MB
    ? Number(process.env.AGENT_VERIFY_MIN_MB)
    : null;

  return {
    stats,
    adaptive,
    minimalGateMb:
      Number(process.env.RAM_GATE_MINIMAL_MB) ||
      legacyMin ||
      adaptive.minimalGateMb,
    buildGateMb:
      Number(process.env.AGENT_VERIFY_BUILD_GATE_MB) ||
      legacyMin ||
      adaptive.buildGateMb,
    compileGateMb:
      Number(process.env.AGENT_VERIFY_COMPILE_GATE_MB) ||
      legacyMin ||
      adaptive.compileGateMb,
    nodeHeapMb:
      Number(process.env.AGENT_VERIFY_NODE_HEAP_MB) || adaptive.nodeHeapMb,
    cargoJobs: String(process.env.AGENT_VERIFY_CARGO_JOBS ?? adaptive.cargoJobs),
  };
}

/** @typedef {"minimal" | "compile" | "build"} RamGateTier */

/**
 * @param {RamGateTier} tier
 * @param {ReturnType<typeof resolveRamLimits>} limits
 */
export function gateMbForTier(tier, limits) {
  switch (tier) {
    case "build":
      return limits.buildGateMb;
    case "compile":
      return limits.compileGateMb;
    default:
      return limits.minimalGateMb;
  }
}

function sleepSeconds(seconds) {
  if (seconds <= 0) return;
  spawnSync("sleep", [String(seconds)], { stdio: "ignore" });
}

function dropCachesHint() {
  spawnSync("sync", { stdio: "ignore" });
}

/**
 * @param {object} options
 * @param {RamGateTier} [options.tier]
 * @param {string} [options.label]
 * @param {boolean} [options.strict]
 * @param {number} [options.waitSec]
 * @returns {boolean}
 */
export function requireRamGate({
  tier = "minimal",
  label = "test",
  strict = process.env.RAM_GATE_STRICT !== "0" &&
    process.env.AGENT_VERIFY_STRICT !== "0",
  waitSec = Number(process.env.RAM_GATE_WAIT_SEC ?? process.env.AGENT_VERIFY_WAIT_SEC ?? 30),
} = {}) {
  if (process.env.RAM_GATE_DISABLED === "1") {
    return true;
  }

  const limits = resolveRamLimits();
  const minMb = gateMbForTier(tier, limits);
  const availableNow = limits.stats.availableMb;

  if (availableNow >= minMb) {
    return true;
  }

  const attempts = Math.max(1, Math.ceil(waitSec / 2));
  for (let attempt = 0; attempt <= attempts; attempt += 1) {
    const available = readMemoryStats().availableMb;
    if (available >= minMb) {
      if (attempt > 0) {
        console.warn(
          `[ram-gate] "${label}" recovered: ${available} MB available (need ${minMb} MB, tier ${tier})`,
        );
      }
      return true;
    }

    if (attempt === 0) {
      dropCachesHint();
      const afterSync = readMemoryStats().availableMb;
      if (afterSync >= minMb) {
        console.warn(
          `[ram-gate] "${label}" low (${available} MB) — recovered after sync (${afterSync} MB)`,
        );
        return true;
      }
    }

    if (attempt < attempts) {
      console.warn(
        `[ram-gate] "${label}" waiting: ${available} MB available, need ${minMb} MB (${attempt + 1}/${attempts}, tier ${tier})`,
      );
      sleepSeconds(2);
      continue;
    }

    const message = `[ram-gate] "${label}" blocked: ${available} MB available, need ${minMb} MB (tier ${tier}, host ${limits.stats.totalMb} MB total)`;
    if (strict) {
      console.error(message);
      return false;
    }
    console.warn(`${message} — continuing (RAM_GATE_STRICT=0)`);
    return true;
  }

  return true;
}

/** @returns {Record<string, string>} */
export function ramLimitedEnv(limits = resolveRamLimits()) {
  return {
    CARGO_BUILD_JOBS: limits.cargoJobs,
    NODE_OPTIONS: `--max-old-space-size=${limits.nodeHeapMb}`,
  };
}

export function formatRamGateSummary(limits = resolveRamLimits()) {
  const { stats, adaptive } = limits;
  return [
    `Host: ${stats.totalMb} MB total, ${stats.availableMb} MB available (${stats.source})`,
    `Gates: minimal ${limits.minimalGateMb} MB, compile ${limits.compileGateMb} MB, build ${limits.buildGateMb} MB`,
    `Caps: NODE heap ${limits.nodeHeapMb} MB, CARGO_BUILD_JOBS=${limits.cargoJobs}`,
    `(auto targets minimal ${adaptive.minimalGateMb} / compile ${adaptive.compileGateMb} / build ${adaptive.buildGateMb} MB)`,
  ].join("\n");
}
