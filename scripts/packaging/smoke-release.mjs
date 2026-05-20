#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..", "..");
const tag = `${process.platform}-${process.arch}`;
const outRoot = resolve(root, "dist", "release", tag);

const required = [
  "dist/src/index.js",
  "ui-dist/index.html",
  "rlm",
  "rlm.cmd",
  "desktop-manifest.json",
  "ensure-ollama.mjs",
];

const nodeRuntime = process.platform === "win32" ? "bin/node.exe" : "bin/node";
required.push(nodeRuntime);

const missing = required.filter((path) => !existsSync(resolve(outRoot, path)));
if (missing.length > 0) {
  console.error(`Release smoke failed; missing ${missing.join(", ")}`);
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(resolve(outRoot, "desktop-manifest.json"), "utf8"));
if (manifest.platform !== process.platform || manifest.arch !== process.arch) {
  console.error("Release smoke failed; manifest platform does not match current build.");
  process.exit(1);
}
if (manifest.runtime?.kind !== "bundled-node" || manifest.runtime?.node !== nodeRuntime) {
  console.error("Release smoke failed; manifest bundled Node runtime metadata is invalid.");
  process.exit(1);
}
if (manifest.ollama?.check !== `${nodeRuntime} ensure-ollama.mjs`) {
  console.error("Release smoke failed; manifest Ollama check does not use the bundled Node runtime.");
  process.exit(1);
}
const nodeCheck = spawnSync(resolve(outRoot, nodeRuntime), ["--version"], {
  encoding: "utf8",
});
if (nodeCheck.status !== 0 || !nodeCheck.stdout.trim().startsWith("v")) {
  console.error("Release smoke failed; bundled Node runtime did not execute.");
  process.exit(1);
}

console.error(`Release smoke passed for ${outRoot}`);
