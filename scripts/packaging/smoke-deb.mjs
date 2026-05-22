#!/usr/bin/env node
/**
 * Install-smoke-uninstall flow for Tauri-built Linux .deb packages.
 *
 * Usage:
 *   npm run package:smoke:deb
 *   npm run package:smoke:deb -- /path/to/package.deb
 *
 * Skip (exit 0): RLM_SKIP_DEB_SMOKE=1 or missing Linux GTK build deps.
 * Requires a pre-built deb from `npm run tauri:build` unless a path is passed.
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  findDebArtifact,
  findInstalledBinaries,
  installDeb,
  missingDebMessage,
  shouldSkipDebSmoke,
  uninstallDeb,
} from "./deb-smoke-lib.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..", "..");

const skip = shouldSkipDebSmoke(process.env);
if (skip.skip) {
  console.error(`${skip.reason} — see docs/DESKTOP.md`);
  process.exit(0);
}

const debFromArgv = process.argv[2];
const debPath = debFromArgv ? resolve(debFromArgv) : findDebArtifact(root);

if (!debPath || !existsSync(debPath)) {
  console.error(missingDebMessage());
  process.exit(1);
}

let installed = false;
try {
  const installResult = installDeb(debPath);
  if (!installResult.ok) {
    console.error(`Deb smoke failed; dpkg install error:\n${installResult.stderr}`);
    process.exit(1);
  }
  installed = true;

  const { cliPath, desktopPath } = findInstalledBinaries(debPath);
  if (!cliPath) {
    console.error("Deb smoke failed; could not locate installed CLI binary via dpkg -L");
    process.exit(1);
  }

  const helpCheck = spawnSync(cliPath, ["--help"], { encoding: "utf8" });
  if (helpCheck.status !== 0) {
    console.error(`Deb smoke failed; ${cliPath} --help exited ${helpCheck.status}`);
    process.exit(1);
  }

  if (desktopPath && !desktopPath.endsWith(".desktop")) {
    smokeDesktopBinary(desktopPath);
  } else if (desktopPath?.endsWith(".desktop")) {
    const execLine = readDesktopExec(desktopPath);
    if (execLine) {
      smokeDesktopBinary(execLine.split(/\s+/)[0]);
    }
  }

  console.error(`Deb smoke passed for ${debPath}`);
} finally {
  if (installed) {
    uninstallDeb(debPath);
  }
}

/**
 * @param {string} binaryPath
 */
function smokeDesktopBinary(binaryPath) {
  const xvfb = spawnSync("which", ["xvfb-run"], { encoding: "utf8" });
  if (xvfb.status !== 0 || !xvfb.stdout.trim()) {
    console.error("Deb smoke failed; xvfb-run not found — install xvfb package");
    process.exit(1);
  }

  const run = spawnSync(
    "xvfb-run",
    ["-a", "timeout", "15s", binaryPath],
    { encoding: "utf8" },
  );

  const combined = `${run.stderr ?? ""}\n${run.stdout ?? ""}`;
  if (/Failed to initialize GTK|Cannot open display/i.test(combined)) {
    console.error(`Deb smoke failed; desktop binary GTK/display error:\n${combined}`);
    process.exit(1);
  }

  if (run.status !== 0 && run.status !== 124) {
    console.error(`Deb smoke failed; desktop binary exited ${run.status}:\n${combined}`);
    process.exit(1);
  }
}

/**
 * @param {string} desktopFile
 * @returns {string | null}
 */
function readDesktopExec(desktopFile) {
  try {
    const content = readFileSync(desktopFile, "utf8");
    const match = content.match(/^Exec=(.+)$/m);
    return match?.[1]?.replace(/%[fFuUdDnNickvm]/g, "").trim() ?? null;
  } catch {
    return null;
  }
}
