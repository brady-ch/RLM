#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..", "..");
const tag = `${process.platform}-${process.arch}`;
const outRoot = resolve(root, "dist", "release", tag);

const rustBinaryName = process.platform === "win32" ? "rlm.exe" : "rlm";
const required = ["ui-dist/index.html", rustBinaryName, "desktop-manifest.json"];

if (process.platform === "win32") {
  required.push("rlm.cmd");
} else {
  required.push("rlm");
}

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
if (manifest.runtime?.kind !== "rust-binary" || manifest.runtime?.binary !== rustBinaryName) {
  console.error("Release smoke failed; manifest Rust runtime metadata is invalid.");
  process.exit(1);
}

const versionCheck = spawnSync(resolve(outRoot, rustBinaryName), ["--help"], {
  encoding: "utf8",
});
if (versionCheck.status !== 0) {
  console.error("Release smoke failed; Rust binary did not execute.");
  process.exit(1);
}

console.error(`Release smoke passed for ${outRoot}`);
