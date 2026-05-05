import type { AgentProfile, SelectedAgent } from "../domain/agents.js";
import type { ToolPort } from "../ports/tool-port.js";

export interface AgentRegistry {
  profiles: AgentProfile[];
  defaultAgentId: string;
}

export function createAgentRegistry(input: {
  defaultTools: ToolPort[];
  researchTools: ToolPort[];
}): AgentRegistry {
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
  const shouldResearch = researchAgent.routingHints.some((hint) => normalized.includes(hint)) ||
    /\b(today|recent|new|news|web|online|citation|citations|look up|find out)\b/.test(normalized);

  return shouldResearch ? researchAgent : findAgentOrThrow(registry, registry.defaultAgentId);
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
