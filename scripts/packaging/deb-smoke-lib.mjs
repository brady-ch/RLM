#!/usr/bin/env node
/**
 * Shared helpers for Linux .deb install smoke tests.
 *
 * Deb artifacts are produced by Tauri at:
 *   src-tauri/target/release/bundle/deb/*.deb
 *
 * Skip vs fail: shouldSkipDebSmoke returns { skip: true } (exit 0 upstream).
 * Missing deb or install/smoke failures are handled by the caller (exit 1).
 */

import { readdirSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Relative path from repo root to Tauri's deb bundle output. */
export const DEB_BUNDLE_REL = "src-tauri/target/release/bundle/deb";

/**
 * Locate the newest `.deb` under the Tauri release bundle directory.
 *
 * @param {string} [root] - Repository root (defaults to repo root from this file).
 * @returns {string | null} Absolute path to the newest `.deb`, or null if none.
 */
export function findDebArtifact(root = resolve(__dirname, "..", "..")) {
  const debDir = resolve(root, DEB_BUNDLE_REL);
  let entries;
  try {
    entries = readdirSync(debDir).filter((name) => name.endsWith(".deb"));
  } catch {
    return null;
  }
  if (entries.length === 0) {
    return null;
  }

  let newest = null;
  let newestMtime = 0;
  for (const name of entries) {
    const fullPath = resolve(debDir, name);
    const mtime = statSync(fullPath).mtimeMs;
    if (mtime >= newestMtime) {
      newestMtime = mtime;
      newest = fullPath;
    }
  }
  return newest;
}

/**
 * Message when no deb artifact exists (used by smoke entry and tests).
 *
 * @returns {string}
 */
export function missingDebMessage() {
  return `No .deb found under ${DEB_BUNDLE_REL}/ — run npm run tauri:build first`;
}

/**
 * Determine whether deb smoke should be skipped (exit 0, not a failure).
 *
 * @param {NodeJS.ProcessEnv} env
 * @param {NodeJS.Platform} [platform]
 * @returns {{ skip: boolean, reason?: string }}
 */
export function shouldSkipDebSmoke(env, platform = process.platform) {
  if (env.RLM_SKIP_DEB_SMOKE === "1") {
    return {
      skip: true,
      reason: "RLM_SKIP_DEB_SMOKE=1 — deb install smoke skipped",
    };
  }

  if (platform !== "linux") {
    return {
      skip: true,
      reason: "deb smoke is Linux-only",
    };
  }

  const pkgConfig = spawnSync("pkg-config", ["--exists", "glib-2.0"], {
    encoding: "utf8",
  });
  if (pkgConfig.status !== 0) {
    return {
      skip: true,
      reason:
        "Tauri Linux build prerequisites missing (pkg-config glib-2.0) — see docs/DESKTOP.md",
    };
  }

  return { skip: false };
}

/**
 * Read Debian package name from a `.deb` file.
 *
 * @param {string} debPath
 * @returns {string | null}
 */
export function getPackageName(debPath) {
  const result = spawnSync("dpkg-deb", ["-f", debPath, "Package"], {
    encoding: "utf8",
  });
  if (result.status !== 0) {
    return null;
  }
  return result.stdout.trim() || null;
}

/**
 * Install a `.deb` with dpkg; attempt dependency fix on first failure.
 *
 * @param {string} debPath
 * @returns {{ ok: boolean, stderr: string }}
 */
export function installDeb(debPath) {
  let result = spawnSync("sudo", ["dpkg", "-i", debPath], {
    encoding: "utf8",
  });
  if (result.status !== 0) {
    spawnSync("sudo", ["apt-get", "install", "-f", "-y"], {
      encoding: "utf8",
      stdio: "inherit",
    });
    result = spawnSync("sudo", ["dpkg", "-i", debPath], {
      encoding: "utf8",
    });
  }
  const stderr = [result.stderr, result.stdout].filter(Boolean).join("\n");
  return { ok: result.status === 0, stderr };
}

/**
 * Resolve installed CLI and optional desktop binary paths via dpkg -L.
 *
 * @param {string} debPath
 * @returns {{ cliPath: string | null, desktopPath: string | null }}
 */
export function findInstalledBinaries(debPath) {
  const packageName = getPackageName(debPath);
  if (!packageName) {
    return { cliPath: null, desktopPath: null };
  }

  const listed = spawnSync("dpkg", ["-L", packageName], { encoding: "utf8" });
  if (listed.status !== 0) {
    return { cliPath: null, desktopPath: null };
  }

  const paths = listed.stdout
    .trim()
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  let cliPath = null;
  let desktopPath = null;

  for (const p of paths) {
    if (p.endsWith("/rlm") && p.startsWith("/usr/bin/")) {
      cliPath = p;
    }
    if (
      !desktopPath &&
      p.startsWith("/usr/bin/") &&
      !p.endsWith(".desktop") &&
      (p.includes("recursive-language-model") || p.endsWith("/rlm-desktop"))
    ) {
      desktopPath = p;
    }
    if (p.endsWith(".desktop") && p.includes("/applications/")) {
      desktopPath = desktopPath ?? p;
    }
  }

  if (!cliPath) {
    for (const p of paths) {
      if (p.startsWith("/usr/bin/") && !p.endsWith(".desktop")) {
        const base = p.split("/").pop() ?? "";
        if (base.includes("recursive") || base === "rlm") {
          cliPath = p;
          break;
        }
      }
    }
  }

  return { cliPath, desktopPath };
}

/**
 * Best-effort uninstall of the package derived from debPath.
 *
 * @param {string} debPath
 * @returns {{ attempted: boolean, ok: boolean }}
 */
export function uninstallDeb(debPath) {
  const packageName = getPackageName(debPath);
  if (!packageName) {
    return { attempted: false, ok: false };
  }

  const installed = spawnSync("dpkg", ["-s", packageName], { encoding: "utf8" });
  if (installed.status !== 0) {
    return { attempted: false, ok: true };
  }

  const result = spawnSync("sudo", ["dpkg", "-r", packageName], {
    encoding: "utf8",
  });
  return { attempted: true, ok: result.status === 0 };
}
