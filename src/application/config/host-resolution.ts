import type {
  ModelHostConfig,
  ModelTierConfig,
  ProjectConfig,
  RuntimeHostSelection,
} from "./types.js";

export function resolveRuntimeHostSelection(
  config: ProjectConfig,
  input: {
    cliHostId?: string | undefined;
    env?: NodeJS.ProcessEnv | undefined;
  } = {},
): RuntimeHostSelection {
  const envHost = input.env?.RLM_HOST?.trim();
  if (envHost) {
    return { hostId: envHost, source: "env" };
  }

  const cliHost = input.cliHostId?.trim();
  if (cliHost) {
    return { hostId: cliHost, source: "cli" };
  }

  const configHost = config.runtimeHost?.trim();
  if (configHost) {
    return { hostId: configHost, source: "config" };
  }

  const defaultHost = Object.keys(config.hosts ?? {})[0];
  if (defaultHost) {
    return { hostId: defaultHost, source: "default" };
  }

  return { hostId: "local_ollama", source: "default" };
}

export function resolveHostConfig(config: ProjectConfig, hostId: string): ModelHostConfig {
  const host = config.hosts?.[hostId];
  if (!host) {
    throw new Error(`Unknown runtime host "${hostId}".`);
  }

  return host;
}

export function resolveModelTier(config: ProjectConfig, selection: string): ModelTierConfig {
  const tier = config.models.tiers[selection];
  if (tier) {
    return tier;
  }

  return {
    name: selection,
    estimatedRamMb: config.models.tiers["small"]?.estimatedRamMb ?? 4096,
  };
}
