import { WebFetchTool } from "../../adapters/tools/web-fetch-tool.js";
import type { ExtensionHostPort } from "../../ports/extension-host-port.js";

export function register(host: ExtensionHostPort): void {
  host.tools.register(new WebFetchTool());
}
