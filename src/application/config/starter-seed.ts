import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { stringify as stringifyYaml } from "yaml";
import { DEFAULT_PROJECT_CONFIG, DEFAULT_PROJECT_PLAIN } from "./defaults.js";
import { safeStat } from "./loader.js";

export async function seedProjectRlmStarter(projectRoot = process.cwd()): Promise<boolean> {
  const dotFolder = join(projectRoot, ".rlm");
  const primaryConfig = join(dotFolder, "config.yaml");
  try {
    if ((await safeStat(primaryConfig))?.isFile()) {
      return false;
    }

    await mkdir(dotFolder, { recursive: true });
    await mkdir(join(dotFolder, "agents"), { recursive: true });
    await mkdir(join(dotFolder, "models"), { recursive: true });

    await writeFile(primaryConfig, stringifyYaml(DEFAULT_PROJECT_PLAIN));

    await writeFile(
      join(dotFolder, "agents", "coding.yaml"),
      stringifyYaml(DEFAULT_PROJECT_CONFIG.agents["coding"]),
    );

    await writeFile(
      join(dotFolder, "models", "small.yaml"),
      stringifyYaml(DEFAULT_PROJECT_CONFIG.models.tiers["small"]),
    );

    console.error(
      "[rlm starter] seeded project-local .rlm/ with sample config, agents/coding.yaml, models/small.yaml",
    );
    return true;
  } catch (error: unknown) {
    const detail = error instanceof Error ? `${error.message} (starter seed)` : "starter seed";
    console.error("[rlm starter] FAILED to seed project .rlm layout:", detail);
    throw new Error(`${dotFolder}: ${detail}`);
  }
}
