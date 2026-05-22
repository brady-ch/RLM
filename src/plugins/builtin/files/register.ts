import type { ExtensionHostPort } from "../../../ports/extension-host-port.js";
import { WorkspaceFileWriteTool } from "./workspace-file-write-tool.js";
import type { PluginManifest } from "../../manifest-schema.js";

export const manifest: PluginManifest = {
  id: "rlm.builtin.files",
  name: "Workspace File Write",
  version: "1.0.0",
  category: "files",
  contributes: {
    tools: ["write_file"],
    skillLoaders: [],
    modelHosts: [],
  },
  engines: {
    rlm: ">=1.0.0",
  },
};

export function register(host: ExtensionHostPort): void {
  host.tools.register(new WorkspaceFileWriteTool({ workspaceRoot: process.cwd() }));
}
