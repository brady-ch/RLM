import { z } from "zod";
import { PLUGIN_CATEGORIES } from "./categories.js";

export const pluginCategorySchema = z.enum(PLUGIN_CATEGORIES);

export const pluginContributesSchema = z.object({
  tools: z.array(z.string().min(1)).default([]),
  skillLoaders: z.array(z.string().min(1)).default([]),
  modelHosts: z.array(z.string().min(1)).default([]),
});

export const pluginManifestSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  version: z.string().min(1),
  category: pluginCategorySchema,
  contributes: pluginContributesSchema.default({
    tools: [],
    skillLoaders: [],
    modelHosts: [],
  }),
  engines: z.object({
    rlm: z.string().min(1),
  }),
});

export type PluginManifest = z.infer<typeof pluginManifestSchema>;

export function parsePluginManifest(raw: unknown, context: string): PluginManifest {
  const result = pluginManifestSchema.safeParse(raw);
  if (!result.success) {
    throw new Error(
      `Invalid plugin manifest at ${context}: ${result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ")}`,
    );
  }

  return result.data;
}

export async function readAndValidatePluginManifest(
  manifestPath: string,
  readFile: (path: string) => Promise<string> = (path) =>
    import("node:fs/promises").then(({ readFile: read }) => read(path, "utf8")),
): Promise<PluginManifest> {
  let rawText: string;
  try {
    rawText = await readFile(manifestPath);
  } catch (error: unknown) {
    const cause = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to read plugin manifest at ${manifestPath}: ${cause}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText) as unknown;
  } catch (error: unknown) {
    const cause = error instanceof Error ? error.message : String(error);
    throw new Error(`Plugin manifest at ${manifestPath} is not valid JSON: ${cause}`);
  }

  return parsePluginManifest(parsed, manifestPath);
}
