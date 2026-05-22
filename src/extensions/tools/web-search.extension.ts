import { WebSearchTool } from "../../adapters/tools/web-search-tool.js";
import type { ExtensionHost } from "../../application/extension-host.js";

export function register(host: ExtensionHost): void {
  host.tools.register(new WebSearchTool());
}
