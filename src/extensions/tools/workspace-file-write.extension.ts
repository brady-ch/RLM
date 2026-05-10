import { WorkspaceFileWriteTool } from "../../adapters/workspace-file-write-tool.js";
import type { ExtensionHost } from "../../application/extension-host.js";

export function register(host: ExtensionHost): void {
  host.tools.register(new WorkspaceFileWriteTool({ workspaceRoot: process.cwd() }));
}
