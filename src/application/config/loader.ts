import { constants } from "node:fs";
import { homedir } from "node:os";
import { access, readFile, readdir, stat } from "node:fs/promises";
import { basename, extname, join, resolve } from "node:path";
import { parse as parseYaml } from "yaml";
import { DEFAULT_PROJECT_PLAIN } from "./defaults.js";
import { configSchema } from "./schema.js";
import type { LoadedProjectConfig, ProjectConfig } from "./types.js";
import { validateConfigReferences } from "./validation.js";
import { isPlainRecord, mergeYamlLayers } from "./yaml-merge.js";

export async function safeStat(pathLike: string) {
  try {
    return await stat(pathLike);
  } catch {
    return undefined;
  }
}

export function parseYamlTagged(pathLike: string, raw: string): unknown {
  try {
    return parseYaml(raw) as unknown;
  } catch (error: unknown) {
    const suffix = error instanceof Error ? error.message : String(error);
    throw new Error(`${pathLike}: ${suffix}`);
  }
}

export async function findDefaultConfigPath(): Promise<string | undefined> {
  const candidate = resolve("rlm.config.yaml");
  try {
    await access(candidate, constants.R_OK);
    return candidate;
  } catch {
    return undefined;
  }
}

export async function loadScopedFragments(scopeRoot: string): Promise<Record<string, unknown>> {
  let accumulator: Record<string, unknown> = {};
  const scopeStat = await safeStat(scopeRoot);
  if (!scopeStat?.isDirectory()) {
    return {};
  }

  const cfgPath = join(scopeRoot, "config.yaml");
  const cfgStat = await safeStat(cfgPath);
  if (cfgStat?.isFile()) {
    const yamlRoot = parseYamlTagged(cfgPath, await readFile(cfgPath, "utf8"));
    if (yamlRoot === null || yamlRoot === undefined || !isPlainRecord(yamlRoot)) {
      throw new Error(`${cfgPath}: expected YAML mapping at root`);
    }

    accumulator = mergeYamlLayers(accumulator, yamlRoot);
  }

  const agentsDir = join(scopeRoot, "agents");
  const agentsStat = await safeStat(agentsDir);
  if (agentsStat?.isDirectory()) {
    const entries = [...(await readdir(agentsDir))].sort((aName, bName) =>
      aName.localeCompare(bName),
    );
    const agentsPartial: Record<string, unknown> = {};
    for (const fileName of entries) {
      if (!fileName.endsWith(".yaml") && !fileName.endsWith(".yml")) continue;
      const agentId = basename(fileName, extname(fileName)).trim();
      if (!agentId) continue;

      const filePath = join(agentsDir, fileName);
      const agentDoc = parseYamlTagged(filePath, await readFile(filePath, "utf8"));
      if (!isPlainRecord(agentDoc)) {
        throw new Error(`${filePath}: agent fragment must map tools/models`);
      }

      agentsPartial[agentId] = agentDoc;
    }

    if (Object.keys(agentsPartial).length > 0) {
      accumulator = mergeYamlLayers(accumulator, { agents: agentsPartial });
    }
  }

  const modelsDir = join(scopeRoot, "models");
  const modelsStat = await safeStat(modelsDir);
  if (modelsStat?.isDirectory()) {
    const tiers: Record<string, unknown> = {};
    const entries = [...(await readdir(modelsDir))].sort((aName, bName) =>
      aName.localeCompare(bName),
    );
    for (const entryName of entries) {
      if (!entryName.endsWith(".yaml") && !entryName.endsWith(".yml")) continue;
      const tierKey = basename(entryName, extname(entryName)).trim();
      if (!tierKey) continue;

      const filePath = join(modelsDir, entryName);
      const tierDoc = parseYamlTagged(filePath, await readFile(filePath, "utf8"));
      if (!isPlainRecord(tierDoc)) {
        throw new Error(`${filePath}: tier fragment must map fields`);
      }

      tiers[tierKey] = tierDoc;
    }

    if (Object.keys(tiers).length > 0) {
      accumulator = mergeYamlLayers(accumulator, { models: { tiers } });
    }
  }

  return accumulator;
}

export async function loadProjectConfig(path?: string): Promise<LoadedProjectConfig> {
  if (path) {
    const resolvedExplicit = resolve(path);
    const raw = await readFile(resolvedExplicit, "utf8");
    const yamlRoot = parseYamlTagged(resolvedExplicit, raw);
    let mergedYaml = structuredClone(DEFAULT_PROJECT_PLAIN);
    mergedYaml = mergeYamlLayers(
      mergedYaml,
      yamlRoot !== null && isPlainRecord(yamlRoot) ? yamlRoot : {},
    );

    const config = configSchema.parse(mergedYaml) as ProjectConfig;
    validateConfigReferences(config);

    return {
      config,
      path: resolvedExplicit,
    };
  }

  let mergedYaml = structuredClone(DEFAULT_PROJECT_PLAIN);

  const globalFragments = join(homedir(), ".rlm");
  if ((await safeStat(globalFragments))?.isDirectory()) {
    mergedYaml = mergeYamlLayers(mergedYaml, await loadScopedFragments(globalFragments));
  }

  let primaryPath: string | undefined;

  const cwd = process.cwd();
  const scopedDir = join(cwd, ".rlm");

  const legacyScoped = resolve(cwd, "rlm.config.yaml");
  const legacyExists = (await safeStat(legacyScoped))?.isFile() ?? false;

  if ((await safeStat(scopedDir))?.isDirectory()) {
    if (legacyExists) {
      const legacyYamlRaw = await readFile(legacyScoped, "utf8");
      const legacyYaml = parseYamlTagged(legacyScoped, legacyYamlRaw);
      if (!legacyYaml || !isPlainRecord(legacyYaml)) {
        throw new Error(`${legacyScoped}: expected YAML mapping at root`);
      }

      mergedYaml = mergeYamlLayers(mergedYaml, legacyYaml);
      primaryPath ??= legacyScoped;
    }

    mergedYaml = mergeYamlLayers(mergedYaml, await loadScopedFragments(scopedDir));

    const cfgChild = join(scopedDir, "config.yaml");
    if ((await safeStat(cfgChild))?.isFile()) {
      primaryPath ??= cfgChild;
    }

    primaryPath ??= legacyExists ? legacyScoped : undefined;
  } else {
    const discoveredPath = legacyExists ? legacyScoped : await findDefaultConfigPath();
    if (discoveredPath) {
      const discoveredRaw = await readFile(discoveredPath, "utf8");
      const parsedDoc = parseYamlTagged(discoveredPath, discoveredRaw);
      if (!isPlainRecord(parsedDoc)) {
        throw new Error(`${discoveredPath}: expected YAML mapping at root`);
      }

      mergedYaml = mergeYamlLayers(mergedYaml, parsedDoc);
      primaryPath ??= discoveredPath;
    }
  }

  const config = configSchema.parse(mergedYaml) as ProjectConfig;
  validateConfigReferences(config);

  return {
    config,
    path: primaryPath,
  };
}
