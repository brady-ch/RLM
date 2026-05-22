export function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function mergeInterop(left: unknown, right: unknown): unknown {
  if (!left) return right;
  if (!right) return left;
  if (!isPlainRecord(left) || !isPlainRecord(right)) {
    return right;
  }

  const lm = left as Record<string, unknown>;
  const rm = right as Record<string, unknown>;
  const lmcp = isPlainRecord(lm["mcp"]) ? (lm["mcp"] as Record<string, unknown>) : {};
  const rmcp = isPlainRecord(rm["mcp"]) ? (rm["mcp"] as Record<string, unknown>) : {};

  const lskills = isPlainRecord(lm["skills"]) ? (lm["skills"] as Record<string, unknown>) : {};
  const rskills = isPlainRecord(rm["skills"]) ? (rm["skills"] as Record<string, unknown>) : {};

  return {
    ...lm,
    ...rm,
    mcp: { ...lmcp, ...rmcp },
    skills: { ...lskills, ...rskills },
  };
}

/** Layer project/global YAML fragments onto each other — agents and tiers replace by id/key. */
export function mergeYamlLayers(
  left: Record<string, unknown>,
  right: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...left };

  for (const [key, incoming] of Object.entries(right)) {
    if (!isPlainRecord(incoming)) {
      out[key] = incoming;
      continue;
    }

    const existingFlat = left[key];

    if (key === "agents" && isPlainRecord(existingFlat)) {
      const mergedAgents = {
        ...(existingFlat as Record<string, unknown>),
        ...(incoming as Record<string, unknown>),
      };
      out["agents"] = mergedAgents;
      continue;
    }

    if (key === "agents") {
      out["agents"] = { ...incoming };
      continue;
    }

    if (key === "models") {
      const prior = isPlainRecord(existingFlat) ? (existingFlat as Record<string, unknown>) : {};
      const leftTiersRaw = prior["tiers"];
      const incomingModels = incoming as Record<string, unknown>;
      const rightTiersRaw = incomingModels["tiers"];
      const leftSamplingRaw = prior["sampling"];
      const rightSamplingRaw = incomingModels["sampling"];
      const leftTiers = isPlainRecord(leftTiersRaw)
        ? (leftTiersRaw as Record<string, unknown>)
        : {};
      const rightTiers = isPlainRecord(rightTiersRaw)
        ? (rightTiersRaw as Record<string, unknown>)
        : {};
      const leftSampling = isPlainRecord(leftSamplingRaw)
        ? (leftSamplingRaw as Record<string, unknown>)
        : {};
      const rightSampling = isPlainRecord(rightSamplingRaw)
        ? (rightSamplingRaw as Record<string, unknown>)
        : {};
      const leftProfiles = isPlainRecord(leftSampling["modelProfiles"])
        ? (leftSampling["modelProfiles"] as Record<string, unknown>)
        : {};
      const rightProfiles = isPlainRecord(rightSampling["modelProfiles"])
        ? (rightSampling["modelProfiles"] as Record<string, unknown>)
        : {};

      const incomingWithoutTiers = { ...incomingModels };
      delete incomingWithoutTiers["tiers"];
      delete incomingWithoutTiers["sampling"];

      out["models"] = {
        ...prior,
        ...incomingWithoutTiers,
        tiers: {
          ...leftTiers,
          ...rightTiers,
        },
        sampling: {
          ...leftSampling,
          ...rightSampling,
          modelProfiles: {
            ...leftProfiles,
            ...rightProfiles,
          },
        },
      };
      continue;
    }

    if (key === "memory" || key === "runtime") {
      const prior = isPlainRecord(existingFlat) ? (existingFlat as Record<string, unknown>) : {};
      out[key] = { ...prior, ...incoming };
      continue;
    }

    if (key === "workflows" || key === "hosts") {
      const prior = isPlainRecord(existingFlat) ? (existingFlat as Record<string, unknown>) : {};
      out[key] = { ...prior, ...incoming };
      continue;
    }

    if (key === "interop") {
      out["interop"] = mergeInterop(existingFlat ?? {}, incoming);
      continue;
    }

    out[key] = incoming;
  }

  return out;
}
