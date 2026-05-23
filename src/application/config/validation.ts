import { isGraphWorkflowConfig, type ProjectConfig } from "./types.js";

/** Post-parse invariant checks — not part of public façade exports. */
export function validateConfigReferences(config: ProjectConfig): void {
  for (const [agentId, agent] of Object.entries(config.agents)) {
    for (const [purpose, selection] of Object.entries(agent.models)) {
      if (
        selection !== "dynamic" &&
        !config.models.tiers[selection] &&
        selection.trim().length === 0
      ) {
        throw new Error(
          `Agent "${agentId}" has invalid model selection for ${purpose}: ${selection}`,
        );
      }
    }
  }

  for (const [workflowId, workflow] of Object.entries(config.workflows)) {
    if (isGraphWorkflowConfig(workflow)) {
      continue;
    }

    for (const agentId of workflow.agents) {
      if (!config.agents[agentId]) {
        throw new Error(`Workflow "${workflowId}" references unknown agent "${agentId}".`);
      }
    }

    if (workflow.qa && !config.agents[workflow.qa.agent]) {
      throw new Error(
        `Workflow "${workflowId}" references unknown QA agent "${workflow.qa.agent}".`,
      );
    }

    for (const tier of workflow.dispatch?.tiers ?? []) {
      for (const agentId of tier.agents) {
        if (!config.agents[agentId]) {
          throw new Error(
            `Workflow "${workflowId}" dispatch tier "${tier.name}" references unknown agent "${agentId}".`,
          );
        }
      }

      if (tier.qa && !workflow.qa) {
        throw new Error(
          `Workflow "${workflowId}" dispatch tier "${tier.name}" enables QA but no QA config is present.`,
        );
      }
    }
  }
}

export function validateMemoryBudget(config: ProjectConfig): void {
  if (config.memory.maxRamMb === "auto") {
    return;
  }
  const cap = config.memory.maxRamMb;
  const violations: string[] = [];
  for (const [tierId, tier] of Object.entries(config.models.tiers)) {
    if (tier.estimatedRamMb > cap) {
      violations.push(
        `models.tiers.${tierId}.estimatedRamMb (${tier.estimatedRamMb} MB) exceeds memory.maxRamMb (${cap} MB)`,
      );
    }
  }
  if (violations.length > 0) {
    throw new Error(violations.join("; "));
  }
}
