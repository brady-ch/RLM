import type { ExtensionHostPort } from "../../../ports/extension-host-port.js";
import { WebFetchTool } from "./web-fetch-tool.js";
import { WebSearchTool } from "./web-search-tool.js";
import type { PluginManifest } from "../../manifest-schema.js";

export const manifest: PluginManifest = {
  id: "rlm.builtin.web",
  name: "Web Search and Fetch",
  version: "1.0.0",
  category: "web",
  contributes: {
    tools: ["web_search", "web_fetch"],
    skillLoaders: [],
    modelHosts: [],
  },
  engines: {
    rlm: ">=1.0.0",
  },
};

export function register(host: ExtensionHostPort): void {
  host.tools.register(new WebSearchTool());
  host.tools.register(new WebFetchTool());
}
