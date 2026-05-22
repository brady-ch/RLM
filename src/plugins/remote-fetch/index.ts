import { mkdtemp } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fetchAndExtractArchive, type ArchiveFetchOptions } from "./archive-extract.js";
import { fetchGitRepository, type GitFetchOptions } from "./git-fetch.js";
import { classifyRemoteInstallSource } from "./url-detection.js";

export {
  ARCHIVE_URL_SUFFIXES,
  MAX_ARCHIVE_DOWNLOAD_BYTES,
  MAX_ARCHIVE_EXTRACT_BYTES,
} from "./constants.js";
export {
  classifyRemoteInstallSource,
  isArchiveUrl,
  isRemoteInstallSource,
  parseGitRemoteUrl,
} from "./url-detection.js";
export { isUnsafeArchiveEntryPath } from "./safe-path.js";
export { fetchAndExtractArchive } from "./archive-extract.js";
export { fetchGitRepository } from "./git-fetch.js";

export type RemoteFetchOptions = ArchiveFetchOptions & GitFetchOptions;

export async function fetchRemotePluginToStaging(
  source: string,
  options: RemoteFetchOptions = {},
): Promise<{ stagingDir: string; cleanup: () => Promise<void> }> {
  const kind = classifyRemoteInstallSource(source);
  if (!kind) {
    throw new Error(
      "Unsupported remote source. Use https://…/archive.tar.gz or git:https://github.com/org/repo.git",
    );
  }

  const stagingDir = await mkdtemp(join(tmpdir(), "rlm-plugin-fetch-"));
  const cleanup = async (): Promise<void> => {
    const { rm } = await import("node:fs/promises");
    await rm(stagingDir, { recursive: true, force: true });
  };

  try {
    if (kind === "https-archive") {
      await fetchAndExtractArchive(source.trim(), stagingDir, options);
    } else {
      await fetchGitRepository(source, stagingDir, options);
    }
  } catch (error) {
    await cleanup();
    throw error;
  }

  return { stagingDir, cleanup };
}
