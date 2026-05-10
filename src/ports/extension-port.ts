import type { ExtensionHost } from "../application/extension-host.js";

export interface ExtensionRegistryEntry {
  path: string;
  agents: string[];
}

export interface ExtensionManifest {
  register(host: ExtensionHost): void;
}
