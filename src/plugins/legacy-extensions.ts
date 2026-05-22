import { createHash } from "node:crypto";
import { basename, dirname, isAbsolute, resolve } from "node:path";
import type { ExtensionRegistryEntry } from "../ports/extension-port.js";
import type { NormalizedPluginEntry } from "./types.js";

/**
 * Compatibility shim: legacy `extensions.load[]` YAML entries normalize to plugin-shaped
 * discovery records for at least one release after the plugins taxonomy lands.
 */
export function normalizeLegacyExtensionEntries(
  entries: ExtensionRegistryEntry[],
  configFilePath: string,
): NormalizedPluginEntry[] {
  const configDir = dirname(configFilePath);

  return entries.map((entry) => {
    const absPath = isAbsolute(entry.path) ? entry.path : resolve(configDir, entry.path);
    return {
      id: legacyExtensionId(absPath),
      path: absPath,
      agents: entry.agents,
      source: "configured",
      enabled: true,
    };
  });
}

export function legacyExtensionId(absPath: string): string {
  const base = basename(absPath).replace(/\.(js|mjs|cjs|ts)$/u, "");
  const hash = createHash("sha256").update(absPath).digest("hex").slice(0, 8);
  return `legacy.${base}.${hash}`;
}

export function mergeConfiguredPluginEntries(
  legacyEntries: ExtensionRegistryEntry[],
  configFilePath: string,
  pluginEntries: NormalizedPluginEntry[] = [],
): NormalizedPluginEntry[] {
  const normalizedLegacy = normalizeLegacyExtensionEntries(legacyEntries, configFilePath);
  const seen = new Set<string>();
  const merged: NormalizedPluginEntry[] = [];

  for (const entry of [...normalizedLegacy, ...pluginEntries]) {
    if (seen.has(entry.id)) {
      continue;
    }

    seen.add(entry.id);
    merged.push(entry);
  }

  return merged;
}
