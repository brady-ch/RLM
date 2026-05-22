import type { ExtensionRegistryEntry } from "../ports/extension-port.js";
import type { PluginManifest } from "./manifest-schema.js";
import type { PluginCategory } from "./categories.js";

export type PluginSource = "builtin" | "configured" | "installed";

export interface PluginDescriptor {
  id: string;
  name: string;
  version: string;
  category: PluginCategory;
  source: PluginSource;
  path: string;
  enabled: boolean;
  contributes: PluginManifest["contributes"];
}

export interface LegacyExtensionEntry extends ExtensionRegistryEntry {
  /** Normalized plugin id when derived from legacy YAML. */
  id?: string | undefined;
}

export interface InstalledPluginCatalogEntry {
  id: string;
  path: string;
  enabled: boolean;
  source?: "local" | "remote" | undefined;
}

export interface InstalledPluginCatalog {
  plugins: InstalledPluginCatalogEntry[];
}

export interface NormalizedPluginEntry {
  id: string;
  path: string;
  agents: string[];
  source: PluginSource;
  enabled: boolean;
}
