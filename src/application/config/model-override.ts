import type { ProjectConfig } from "./types.js";

export function applyModelOverride(config: ProjectConfig, modelOverride?: string): ProjectConfig {
  if (!modelOverride) {
    return config;
  }

  const smallTier = config.models.tiers["small"] ?? {
    name: modelOverride,
    estimatedRamMb: 4096,
  };

  return {
    ...config,
    models: {
      ...config.models,
      default: modelOverride,
      tiers: {
        ...config.models.tiers,
        small: {
          ...smallTier,
          name: modelOverride,
        },
      },
    },
  };
}
