import { WorkspaceFileWriteTool } from "../../adapters/tools/workspace-file-write-tool.js";
import type { ExtensionHostPort } from "../../ports/extension-host-port.js";

export function register(host: ExtensionHostPort): void {
  host.tools.register(new WorkspaceFileWriteTool({ workspaceRoot: process.cwd() }));
}
