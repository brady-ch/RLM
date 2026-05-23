import { MemoryManager, type MemorySnapshot } from "../memory/memory-manager.js";
import type { ProjectConfig } from "../project-config.js";

export type ModelRamEligibility = {
  disabled: boolean;
  disabledReason?: string | undefined;
  snapshot: MemorySnapshot;
};

export const CURATED_MODEL_RAM_MB: Record<string, number> = {
  "granite4.1:3b": 4096,
  "llama3.1:8b": 8192,
  "qwen2.5-coder:14b": 16000,
};

export function resolveMemorySnapshot(
  config: ProjectConfig,
  memorySnapshot?: (() => MemorySnapshot) | undefined,
): MemorySnapshot {
  return memorySnapshot?.() ?? new MemoryManager({ config: config.memory }).snapshot();
}

export function modelRamEligibility(
  estimatedRamMb: number | undefined,
  snapshot: MemorySnapshot,
): ModelRamEligibility {
  if (estimatedRamMb === undefined || estimatedRamMb <= snapshot.availableRamMb) {
    return { disabled: false, snapshot };
  }
  return {
    disabled: true,
    disabledReason: `Model requires ${estimatedRamMb} MB but only ${snapshot.availableRamMb} MB is available.`,
    snapshot,
  };
}

export function assertModelRamEligible(
  model: string,
  estimatedRamMb: number | undefined,
  snapshot: MemorySnapshot,
): void {
  const eligibility = modelRamEligibility(estimatedRamMb, snapshot);
  if (eligibility.disabled) {
    throw new Error(`Model "${model}" ${eligibility.disabledReason}`);
  }
}

export function estimateModelRamMb(config: ProjectConfig, model: string): number | undefined {
  const configured = Object.values(config.models.tiers).find((tier) => tier.name === model);
  return configured?.estimatedRamMb ?? CURATED_MODEL_RAM_MB[model];
}
