import { resolve } from "node:path";

export function isUnsafeArchiveEntryPath(entryPath: string, extractRoot: string): boolean {
  const normalized = entryPath.replace(/\\/gu, "/");
  if (normalized.startsWith("/") || /^[A-Za-z]:\//u.test(normalized)) {
    return true;
  }

  if (normalized.split("/").some((segment) => segment === "..")) {
    return true;
  }

  const resolved = resolve(extractRoot, normalized);
  const rootWithSep = extractRoot.endsWith("/") ? extractRoot : `${extractRoot}/`;
  return !resolved.startsWith(rootWithSep) && resolved !== extractRoot;
}
