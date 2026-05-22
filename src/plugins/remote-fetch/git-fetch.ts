import { mkdir, rm } from "node:fs/promises";
import { spawn } from "node:child_process";
import { parseGitRemoteUrl } from "./url-detection.js";

export type GitFetchOptions = {
  spawnFn?: typeof spawn;
};

export async function fetchGitRepository(
  source: string,
  targetDir: string,
  options: GitFetchOptions = {},
): Promise<void> {
  const remoteUrl = parseGitRemoteUrl(source);
  const spawnFn = options.spawnFn ?? spawn;

  await rm(targetDir, { recursive: true, force: true });
  await mkdir(targetDir, { recursive: true });

  await new Promise<void>((resolvePromise, rejectPromise) => {
    const child = spawnFn("git", ["clone", "--depth", "1", remoteUrl, targetDir], {
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stderr = "";
    child.stderr?.on("data", (chunk: Buffer | string) => {
      stderr += String(chunk);
    });

    child.on("error", (error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") {
        rejectPromise(
          new Error("git is not available on PATH. Install git or use an HTTPS archive URL."),
        );
        return;
      }

      rejectPromise(error);
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolvePromise();
        return;
      }

      rejectPromise(new Error(stderr.trim() || `git clone failed with exit code ${code}.`));
    });
  });
}
