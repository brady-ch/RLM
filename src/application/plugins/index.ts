/**
 * Plugin manager application layer — registry service shared by CLI and control-server.
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
  getProjectPluginCatalogPath,
  getUserPluginCatalogPath,
  getUserPluginInstallDir,
  getUserPluginsRoot,
} from "../../plugins/index.js";
export type {
  PluginCategory,
  PluginDescriptor,
  PluginLoadOptions,
  PluginManifest,
  PluginSource,
} from "../../plugins/index.js";
export type { ExtensionRegistryEntry } from "../../ports/extension-port.js";
export { PluginRegistryService, createPluginRegistryService } from "./plugin-registry-service.js";
export type {
  PluginDoctorIssue,
  PluginDoctorOptions,
  PluginDoctorResult,
  PluginInstallRemoteOptions,
  PluginInstallRemotePreview,
  PluginInstallRemoteResult,
  PluginListItem,
  PluginListSource,
  PluginMutationResult,
  PluginRegistryServiceOptions,
} from "./plugin-registry-service.js";
