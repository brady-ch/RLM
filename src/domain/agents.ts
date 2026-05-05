import type { ToolPort } from "../ports/tool-port.js";
import type { AgentConfig } from "../application/project-config.js";

export interface AgentProfile {
  id: string;
  description: string;
  systemPrompt: string;
  tools: ToolPort[];
  routingHints: string[];
  config: AgentConfig;
}

export interface SelectedAgent {
  id: string;
  source: "auto" | "override";
  systemPrompt: string;
}
