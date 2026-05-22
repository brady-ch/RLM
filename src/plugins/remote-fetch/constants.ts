/** Maximum compressed archive download size (50 MiB). */
export const MAX_ARCHIVE_DOWNLOAD_BYTES = 50 * 1024 * 1024;

/** Maximum total uncompressed bytes extracted from an archive (100 MiB). */
export const MAX_ARCHIVE_EXTRACT_BYTES = 100 * 1024 * 1024;

/** Allowed archive URL suffixes for HTTPS install. */
export const ARCHIVE_URL_SUFFIXES = [".tar.gz", ".tgz"] as const;
