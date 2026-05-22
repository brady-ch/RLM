import type { ExtensionHostPort } from "./extension-host-port.js";

export interface ExtensionRegistryEntry {
  path: string;
  agents: string[];
}

export interface ExtensionManifest {
  register(host: ExtensionHostPort): void;
}
