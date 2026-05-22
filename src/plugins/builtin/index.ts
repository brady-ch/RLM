import * as filesPlugin from "./files/register.js";
import * as shellPlugin from "./shell/register.js";
import * as webPlugin from "./web/register.js";
import type { ExtensionHostPort } from "../../ports/extension-host-port.js";
import type { PluginManifest } from "../manifest-schema.js";

export type BuiltinPluginDefinition = {
  path: string;
  manifest: PluginManifest;
  register: (host: ExtensionHostPort) => void;
};

export const BUILTIN_PLUGINS: BuiltinPluginDefinition[] = [
  {
    path: "src/plugins/builtin/shell/register.ts",
    manifest: shellPlugin.manifest,
    register: shellPlugin.register,
  },
  {
    path: "src/plugins/builtin/files/register.ts",
    manifest: filesPlugin.manifest,
    register: filesPlugin.register,
  },
  {
    path: "src/plugins/builtin/web/register.ts",
    manifest: webPlugin.manifest,
    register: webPlugin.register,
  },
];
