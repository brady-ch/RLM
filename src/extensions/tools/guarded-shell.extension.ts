import { GuardedShellTool } from "../../adapters/tools/guarded-shell-tool.js";
import type { ExtensionHost } from "../../application/extension-host.js";

export function register(host: ExtensionHost): void {
  host.tools.register(new GuardedShellTool({ workspaceRoot: process.cwd() }));
}
