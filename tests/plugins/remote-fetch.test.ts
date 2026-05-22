import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Readable } from "node:stream";
import test from "node:test";
import * as tar from "tar";
import {
  fetchAndExtractArchive,
  fetchGitRepository,
  isRemoteInstallSource,
  isUnsafeArchiveEntryPath,
  parseGitRemoteUrl,
} from "../../src/plugins/remote-fetch/index.js";

test("isRemoteInstallSource detects https archives and git URLs", () => {
  assert.equal(isRemoteInstallSource("https://example.com/plugin.tar.gz"), true);
  assert.equal(isRemoteInstallSource("https://example.com/plugin.tgz"), true);
  assert.equal(isRemoteInstallSource("git:https://github.com/org/repo.git"), true);
  assert.equal(isRemoteInstallSource("./local-plugin"), false);
  assert.equal(isRemoteInstallSource("https://example.com/plugin.zip"), false);
});

test("parseGitRemoteUrl strips git: prefix", () => {
  assert.equal(
    parseGitRemoteUrl("git:https://github.com/org/repo.git"),
    "https://github.com/org/repo.git",
  );
});

test("isUnsafeArchiveEntryPath rejects traversal and absolute paths", () => {
  const root = "/tmp/extract";
  assert.equal(isUnsafeArchiveEntryPath("../etc/passwd", root), true);
  assert.equal(isUnsafeArchiveEntryPath("/etc/passwd", root), true);
  assert.equal(isUnsafeArchiveEntryPath("plugin/rlm.plugin.json", root), false);
});

test("fetchAndExtractArchive rejects zip-slip entries", async () => {
  const fixtureRoot = await mkdtemp(join(tmpdir(), "rlm-remote-fetch-"));
  const archivePath = join(fixtureRoot, "evil.tgz");
  const extractRoot = join(fixtureRoot, "extract");

  try {
    await createMaliciousArchive(archivePath);
    const archiveBytes = await readFile(archivePath);

    await assert.rejects(
      fetchAndExtractArchive("https://example.com/evil.tgz", extractRoot, {
        fetchFn: async () => mockArchiveResponse(archiveBytes),
        maxDownloadBytes: 1024 * 1024,
        maxExtractBytes: 1024 * 1024,
      }),
      /unsafe archive entry path/i,
    );
  } finally {
    await rm(fixtureRoot, { recursive: true, force: true });
  }
});

test("fetchAndExtractArchive extracts valid plugin layout", async () => {
  const fixtureRoot = await mkdtemp(join(tmpdir(), "rlm-remote-fetch-"));
  const archivePath = join(fixtureRoot, "plugin.tgz");
  const extractRoot = join(fixtureRoot, "extract");

  try {
    await createValidPluginArchive(archivePath);
    const archiveBytes = await readFile(archivePath);

    await fetchAndExtractArchive("https://example.com/plugin.tgz", extractRoot, {
      fetchFn: async () => mockArchiveResponse(archiveBytes),
    });

    const manifest = JSON.parse(await readFile(join(extractRoot, "rlm.plugin.json"), "utf8")) as {
      id: string;
    };
    assert.equal(manifest.id, "remote.test.plugin");
  } finally {
    await rm(fixtureRoot, { recursive: true, force: true });
  }
});

test("fetchGitRepository uses git clone spawn only", async () => {
  const calls: string[][] = [];
  const spawnFn = ((command: string, args?: readonly string[]) => {
    if (command === "git" && args) {
      calls.push([...args]);
    }
    return {
      stderr: { on: () => undefined },
      on(event: string, handler: (code: number) => void) {
        if (event === "close") {
          handler(0);
        }
      },
    };
  }) as unknown as typeof import("node:child_process").spawn;

  await fetchGitRepository("git:https://github.com/org/repo.git", "/tmp/target", {
    spawnFn,
  });

  assert.deepEqual(calls[0], [
    "clone",
    "--depth",
    "1",
    "https://github.com/org/repo.git",
    "/tmp/target",
  ]);
});

async function createValidPluginArchive(archivePath: string): Promise<void> {
  const staging = join(archivePath, "..", "stage");
  await mkdir(staging, { recursive: true });
  await writeFile(
    join(staging, "rlm.plugin.json"),
    JSON.stringify({
      id: "remote.test.plugin",
      name: "Remote Test",
      version: "1.0.0",
      category: "interop",
      contributes: { tools: ["remote_tool"] },
      engines: { rlm: ">=1.0.0" },
    }),
    "utf8",
  );
  await writeFile(
    join(staging, "index.mjs"),
    'export function register(host) { host.tools.register({ name: "remote_tool", description: "x", schema: {}, async execute() { return { status: "success", output: "ok" }; } }); }',
    "utf8",
  );
  await tar.c({ gzip: true, file: archivePath, cwd: staging }, ["rlm.plugin.json", "index.mjs"]);
}

async function createMaliciousArchive(archivePath: string): Promise<void> {
  const staging = join(archivePath, "..", "stage");
  const parent = join(staging, "..");
  await mkdir(staging, { recursive: true });
  await writeFile(join(staging, "rlm.plugin.json"), "{}", "utf8");
  await writeFile(join(parent, "escape.txt"), "evil", "utf8");
  await tar.c({ gzip: true, file: archivePath, cwd: staging }, [
    "rlm.plugin.json",
    "../escape.txt",
  ]);
}

function mockArchiveResponse(body: Buffer): Response {
  return {
    ok: true,
    status: 200,
    headers: new Headers({ "content-length": String(body.byteLength) }),
    body: Readable.toWeb(Readable.from(body)),
  } as Response;
}
