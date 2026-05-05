import type { AgentProfile, SelectedAgent } from "../domain/agents.js";
import type { ToolPort } from "../ports/tool-port.js";
import type { AgentConfig } from "./project-config.js";
import { DEFAULT_PROJECT_CONFIG } from "./project-config.js";

export interface AgentRegistry {
  profiles: AgentProfile[];
  defaultAgentId: string;
}

export function createAgentRegistry(input: {
  defaultTools: ToolPort[];
  researchTools: ToolPort[];
  codingTools?: ToolPort[];
  productDesignerTools?: ToolPort[];
  agentConfigs?: Record<string, AgentConfig>;
}): AgentRegistry {
  const agentConfigs = input.agentConfigs ?? DEFAULT_PROJECT_CONFIG.agents;
  const codingTools = input.codingTools ?? input.defaultTools;
  const productDesignerTools = input.productDesignerTools ?? input.researchTools;

  return {
    defaultAgentId: "default",
    profiles: [
      {
        id: "default",
        description: "General recursive assistant with local workspace tools.",
        systemPrompt:
          "You are a general recursive assistant. Use available local tools only when they directly improve the answer.",
        tools: input.defaultTools,
        routingHints: ["explain", "write", "edit", "local", "code", "summarize"],
        config: agentConfigOrThrow(agentConfigs, "default"),
      },
      {
        id: "coding",
        description: "Coding specialist with workspace inspection and file-writing tools.",
        systemPrompt:
          "You are a coding agent. Inspect the workspace before changing behavior, prefer small scoped edits, " +
          "use shell for read-only inspection and write_file for file changes, and verify with targeted tests or type checks when possible.",
        tools: codingTools,
        routingHints: [
          "code",
          "coding",
          "implement",
          "fix",
          "bug",
          "test",
          "typecheck",
          "refactor",
          "typescript",
          "cli",
          "file",
          "write",
        ],
        config: agentConfigOrThrow(agentConfigs, "coding"),
      },
      {
        id: "product_designer",
        description: "Product design specialist with research and artifact-writing tools.",
        systemPrompt:
          "You are a product designer. Focus on user goals, product flows, UX tradeoffs, information architecture, " +
          "interface states, and concise design artifacts. Use google_search for market or pattern research and write_file for specs when useful.",
        tools: productDesignerTools,
        routingHints: [
          "product",
          "designer",
          "design",
          "ux",
          "ui",
          "wireframe",
          "prototype",
          "flow",
          "user journey",
          "persona",
          "roadmap",
          "requirements",
        ],
        config: agentConfigOrThrow(agentConfigs, "product_designer"),
      },
      {
        id: "research",
        description: "Research specialist with web search access and source-grounded answers.",
        systemPrompt:
          "You are a research specialist. Use google_search for current facts, source-backed claims, comparisons, and verification. " +
          "Build focused searches with exact phrases, required terms, excluded terms, site filters, filetype filters, and date bounds where useful. " +
          "Prefer primary or official sources. Cite the links you rely on in the final answer.",
        tools: input.researchTools,
        routingHints: ["research", "search", "google", "latest", "current", "source", "sources", "cite", "verify", "compare"],
        config: agentConfigOrThrow(agentConfigs, "research"),
      },
    ],
  };
}

export function selectAgent(registry: AgentRegistry, prompt: string, override?: string): AgentProfile {
  if (override) {
    return findAgentOrThrow(registry, override);
  }

  const normalized = prompt.toLowerCase();
  const researchAgent = findAgentOrThrow(registry, "research");
  const shouldResearch = matchesAgent(normalized, researchAgent) ||
    /\b(today|latest|recent|new|news|web|online|citation|citations|look up|find out)\b/.test(normalized);
  if (shouldResearch) {
    return researchAgent;
  }

  const codingAgent = findAgentOrThrow(registry, "coding");
  if (matchesAgent(normalized, codingAgent)) {
    return codingAgent;
  }

  const productDesignerAgent = findAgentOrThrow(registry, "product_designer");
  if (matchesAgent(normalized, productDesignerAgent)) {
    return productDesignerAgent;
  }

  return findAgentOrThrow(registry, registry.defaultAgentId);
}

export function selectedAgentMetadata(agent: AgentProfile, source: SelectedAgent["source"]): SelectedAgent {
  return {
    id: agent.id,
    source,
    systemPrompt: agent.systemPrompt,
  };
}

function findAgentOrThrow(registry: AgentRegistry, id: string): AgentProfile {
  const profile = registry.profiles.find((agent) => agent.id === id);
  if (!profile) {
    throw new Error(`Unknown agent "${id}". Available agents: ${registry.profiles.map((agent) => agent.id).join(", ")}`);
  }

  return profile;
}

function matchesAgent(normalizedPrompt: string, agent: AgentProfile): boolean {
  return agent.routingHints.some((hint) => normalizedPrompt.includes(hint));
}

function agentConfigOrThrow(configs: Record<string, AgentConfig>, id: string): AgentConfig {
  const config = configs[id];
  if (!config) {
    throw new Error(`Missing configuration for agent "${id}".`);
  }

  return config;
}
