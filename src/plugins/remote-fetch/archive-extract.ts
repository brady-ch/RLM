import { createWriteStream } from "node:fs";
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import * as tar from "tar";
import { MAX_ARCHIVE_DOWNLOAD_BYTES, MAX_ARCHIVE_EXTRACT_BYTES } from "./constants.js";
import { isUnsafeArchiveEntryPath } from "./safe-path.js";

export type ArchiveFetchOptions = {
  fetchFn?: typeof fetch;
  maxDownloadBytes?: number;
  maxExtractBytes?: number;
};

export async function fetchAndExtractArchive(
  url: string,
  extractRoot: string,
  options: ArchiveFetchOptions = {},
): Promise<void> {
  const fetchFn = options.fetchFn ?? fetch;
  const maxDownloadBytes = options.maxDownloadBytes ?? MAX_ARCHIVE_DOWNLOAD_BYTES;
  const maxExtractBytes = options.maxExtractBytes ?? MAX_ARCHIVE_EXTRACT_BYTES;

  await rm(extractRoot, { recursive: true, force: true });
  await mkdir(extractRoot, { recursive: true });

  const response = await fetchFn(url, { redirect: "follow" });
  if (!response.ok) {
    throw new Error(`Archive download failed with HTTP ${response.status}.`);
  }

  if (response.body === null) {
    throw new Error("Archive download returned an empty body.");
  }

  const contentLength = response.headers.get("content-length");
  if (contentLength) {
    const declared = Number.parseInt(contentLength, 10);
    if (Number.isFinite(declared) && declared > maxDownloadBytes) {
      throw new Error(
        `Archive exceeds max download size (${maxDownloadBytes} bytes): ${declared} bytes declared.`,
      );
    }
  }

  const downloadPath = join(extractRoot, "archive.tgz");
  let downloadedBytes = 0;
  const reader = response.body.getReader();
  const downloadStream = new Readable({
    async read() {
      const { done, value } = await reader.read();
      if (done) {
        this.push(null);
        return;
      }

      downloadedBytes += value.byteLength;
      if (downloadedBytes > maxDownloadBytes) {
        this.destroy(new Error(`Archive exceeds max download size (${maxDownloadBytes} bytes).`));
        return;
      }

      this.push(Buffer.from(value));
    },
  });

  await pipeline(downloadStream, createWriteStream(downloadPath));

  let extractedBytes = 0;
  let rejectedPath: string | undefined;
  await tar.x({
    file: downloadPath,
    cwd: extractRoot,
    strict: true,
    filter: (entryPath, entry) => {
      if (isUnsafeArchiveEntryPath(entryPath, extractRoot)) {
        rejectedPath = entryPath;
        return false;
      }

      extractedBytes += entry.size;
      if (extractedBytes > maxExtractBytes) {
        throw new Error(`Archive exceeds max extract size (${maxExtractBytes} bytes).`);
      }

      return true;
    },
  });

  if (rejectedPath) {
    throw new Error(`Rejected unsafe archive entry path: ${rejectedPath}`);
  }

  await rm(downloadPath, { force: true });
}
