import { homedir } from "node:os";
import { join } from "node:path";

/** User-level managed plugin root (`~/.rlm/plugins`). */
export function getUserPluginsRoot(): string {
  return join(homedir(), ".rlm", "plugins");
}

/** User-level installed plugin catalog (`~/.rlm/plugins/catalog.json`). */
export function getUserPluginCatalogPath(): string {
  return join(getUserPluginsRoot(), "catalog.json");
}

/** Install directory for a plugin id under the user catalog root. */
export function getUserPluginInstallDir(pluginId: string): string {
  return join(getUserPluginsRoot(), pluginId);
}

/** Project-local plugin catalog (`.rlm/plugins/catalog.json`). */
export function getProjectPluginCatalogPath(projectRoot: string): string {
  return join(projectRoot, ".rlm", "plugins", "catalog.json");
}
