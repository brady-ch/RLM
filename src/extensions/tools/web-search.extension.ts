import { WebSearchTool } from "../../adapters/web-search-tool.js";
import type { ExtensionHost } from "../../application/extension-host.js";

export function register(host: ExtensionHost): void {
  host.tools.register(new WebSearchTool());
}
