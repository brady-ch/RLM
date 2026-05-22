export { PLUGIN_CATEGORIES, formatPluginCategory, isPluginCategory } from "./categories.js";
export type { PluginCategory } from "./categories.js";
export {
  parsePluginManifest,
  pluginCategorySchema,
  pluginContributesSchema,
  pluginManifestSchema,
  readAndValidatePluginManifest,
} from "./manifest-schema.js";
export type { PluginManifest } from "./manifest-schema.js";
export {
  legacyExtensionId,
  mergeConfiguredPluginEntries,
  normalizeLegacyExtensionEntries,
} from "./legacy-extensions.js";
export { PluginLoader } from "./plugin-loader.js";
export type { PluginLoadOptions } from "./plugin-loader.js";
export { BUILTIN_PLUGINS } from "./builtin/index.js";
export type {
  InstalledPluginCatalog,
  InstalledPluginCatalogEntry,
  LegacyExtensionEntry,
  NormalizedPluginEntry,
  PluginDescriptor,
  PluginSource,
} from "./types.js";
