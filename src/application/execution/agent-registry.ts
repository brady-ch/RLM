import type { AgentProfile, SelectedAgent } from "../../domain/agents.js";
import type { ToolPort } from "../../ports/tool-port.js";
import type { AgentConfig } from "../project-config.js";
import { DEFAULT_PROJECT_CONFIG } from "../project-config.js";

export interface AgentRegistry {
  profiles: AgentProfile[];
  defaultAgentId: string;
}

export function createAgentRegistry(input: {
  defaultTools: ToolPort[];
  researchTools: ToolPort[];
  codingTools?: ToolPort[];
  qaTools?: ToolPort[];
  productDesignerTools?: ToolPort[];
  agentConfigs?: Record<string, AgentConfig>;
}): AgentRegistry {
  const agentConfigs = input.agentConfigs ?? DEFAULT_PROJECT_CONFIG.agents;
  const codingTools = input.codingTools ?? input.defaultTools;
  const qaTools = input.qaTools ?? codingTools;
  const productDesignerTools = input.productDesignerTools ?? input.researchTools;

  const profiles: AgentProfile[] = [
    {
      id: "default",
      description: "General recursive assistant with local workspace tools.",
      systemPrompt:
        "You are a general recursive assistant. Use available local or web tools only when they directly improve the answer. " +
        "When researching online, search first, then fetch and analyze the most relevant result pages with web_fetch.",
      tools: input.defaultTools,
      routingHints: ["explain", "write", "edit", "local", "code", "summarize"],
      config: agentConfigOrThrow(agentConfigs, "default"),
    },
    {
      id: "coding",
      description: "Coding specialist with workspace inspection and file-writing tools.",
      systemPrompt:
        "You are a coding agent. Inspect the workspace before changing behavior, prefer small scoped edits, " +
        "use shell for read-only inspection and write_file for file changes, and verify with targeted tests or type checks when possible. " +
        "For external docs, use web_search, then web_fetch to extract the most relevant page sections before answering.",
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
  ];

  if (agentConfigs["qa"]) {
    profiles.push({
      id: "qa",
      description: "QA specialist that validates behavior and schedules high-priority bugfix work.",
      systemPrompt:
        "You are a QA agent. Review implementation results, validation output, and expected functionality. " +
        "When tests, builds, or functional validation reveal defects, schedule bugfix tasks as lines in the format " +
        "BUGFIX[keyword1, keyword2]: concise task. Prefer the highest-impact failure keywords.",
      tools: qaTools,
      routingHints: [
        "qa",
        "quality",
        "validate",
        "validation",
        "bugfix",
        "regression",
        "test",
        "build",
      ],
      config: agentConfigOrThrow(agentConfigs, "qa"),
    });
  }

  profiles.push(
    {
      id: "product_designer",
      description: "Product design specialist with research and artifact-writing tools.",
      systemPrompt:
        "You are a product designer. Focus on user goals, product flows, UX tradeoffs, information architecture, " +
        "interface states, and concise design artifacts. Use web_search for market or pattern research, web_fetch to analyze chosen pages, " +
        "and write_file for specs when useful.",
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
        "You are a research specialist. Use web_search for current facts, source-backed claims, comparisons, and verification. " +
        "Build focused searches with exact phrases, required terms, excluded terms, site filters, filetype filters, and date bounds where useful. " +
        "Fetch promising result URLs with web_fetch, use the selected content-tree sections, prefer primary or official sources, " +
        "and cite the links you rely on in the final answer.",
      tools: input.researchTools,
      routingHints: [
        "research",
        "search",
        "lookup",
        "latest",
        "current",
        "source",
        "sources",
        "cite",
        "verify",
        "compare",
      ],
      config: agentConfigOrThrow(agentConfigs, "research"),
    },
  );

  return {
    defaultAgentId: "default",
    profiles,
  };
}

export function selectAgent(
  registry: AgentRegistry,
  prompt: string,
  override?: string,
): AgentProfile {
  if (override) {
    return findAgentOrThrow(registry, override);
  }

  const normalized = prompt.toLowerCase();
  const researchAgent = findAgentOrThrow(registry, "research");
  const shouldResearch =
    matchesAgent(normalized, researchAgent) ||
    /\b(today|latest|recent|new|news|web|online|citation|citations|look up|find out)\b/.test(
      normalized,
    );
  if (shouldResearch) {
    return researchAgent;
  }

  const codingAgent = findAgentOrThrow(registry, "coding");
  if (matchesAgent(normalized, codingAgent)) {
    return codingAgent;
  }

  const qaAgent = registry.profiles.find((agent) => agent.id === "qa");
  if (qaAgent && matchesAgent(normalized, qaAgent)) {
    return qaAgent;
  }

  const productDesignerAgent = findAgentOrThrow(registry, "product_designer");
  if (matchesAgent(normalized, productDesignerAgent)) {
    return productDesignerAgent;
  }

  return findAgentOrThrow(registry, registry.defaultAgentId);
}

export function selectedAgentMetadata(
  agent: AgentProfile,
  source: SelectedAgent["source"],
): SelectedAgent {
  return {
    id: agent.id,
    source,
    systemPrompt: agent.systemPrompt,
  };
}

export function resolveAgent(registry: AgentRegistry, id: string): AgentProfile {
  return findAgentOrThrow(registry, id);
}

function findAgentOrThrow(registry: AgentRegistry, id: string): AgentProfile {
  const profile = registry.profiles.find((agent) => agent.id === id);
  if (!profile) {
    throw new Error(
      `Unknown agent "${id}". Available agents: ${registry.profiles.map((agent) => agent.id).join(", ")}`,
    );
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
