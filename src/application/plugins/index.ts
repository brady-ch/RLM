/**
 * Plugin manager application layer — list/doctor UX expands in Phase 49+.
 * Runtime discovery lives in src/plugins/plugin-loader.ts.
 */
export {
  PluginLoader,
  formatPluginCategory,
  legacyExtensionId,
  mergeConfiguredPluginEntries,
  normalizeLegacyExtensionEntries,
  parsePluginManifest,
  pluginCategorySchema,
  pluginManifestSchema,
} from "../../plugins/index.js";
export type {
  PluginCategory,
  PluginDescriptor,
  PluginLoadOptions,
  PluginManifest,
  PluginSource,
} from "../../plugins/index.js";
export type { ExtensionRegistryEntry } from "../../ports/extension-port.js";
