import { ARCHIVE_URL_SUFFIXES } from "./constants.js";

export type RemoteInstallKind = "https-archive" | "git";

export function isRemoteInstallSource(source: string): boolean {
  return classifyRemoteInstallSource(source) !== null;
}

export function classifyRemoteInstallSource(source: string): RemoteInstallKind | null {
  const trimmed = source.trim();
  if (/^git:/iu.test(trimmed)) {
    return "git";
  }

  if (/^https?:\/\//iu.test(trimmed) && isArchiveUrl(trimmed)) {
    return "https-archive";
  }

  return null;
}

export function isArchiveUrl(url: string): boolean {
  const normalized = url.split("?")[0]?.split("#")[0]?.toLowerCase() ?? url.toLowerCase();
  return ARCHIVE_URL_SUFFIXES.some((suffix) => normalized.endsWith(suffix));
}

export function parseGitRemoteUrl(source: string): string {
  const trimmed = source.trim();
  if (!/^git:/iu.test(trimmed)) {
    throw new Error(`Expected git: URL prefix. Example: git:https://github.com/org/repo.git`);
  }

  const remote = trimmed.replace(/^git:/iu, "").trim();
  if (!remote) {
    throw new Error("Missing git remote URL after git: prefix.");
  }

  return remote;
}
