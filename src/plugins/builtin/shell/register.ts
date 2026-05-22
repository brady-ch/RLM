import type { ExtensionHostPort } from "../../../ports/extension-host-port.js";
import { GuardedShellTool } from "./guarded-shell-tool.js";
import type { PluginManifest } from "../../manifest-schema.js";

export const manifest: PluginManifest = {
  id: "rlm.builtin.shell",
  name: "Guarded Shell",
  version: "1.0.0",
  category: "shell",
  contributes: {
    tools: ["shell"],
    skillLoaders: [],
    modelHosts: [],
  },
  engines: {
    rlm: ">=1.0.0",
  },
};

export function register(host: ExtensionHostPort): void {
  host.tools.register(new GuardedShellTool({ workspaceRoot: process.cwd() }));
}
