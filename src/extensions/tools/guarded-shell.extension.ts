import { GuardedShellTool } from "../../adapters/tools/guarded-shell-tool.js";
import type { ExtensionHostPort } from "../../ports/extension-host-port.js";

export function register(host: ExtensionHostPort): void {
  host.tools.register(new GuardedShellTool({ workspaceRoot: process.cwd() }));
}
