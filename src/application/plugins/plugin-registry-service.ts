import { createHash } from "node:crypto";
import { access, cp, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { basename, dirname, isAbsolute, join, resolve } from "node:path";
import { BUILTIN_PLUGINS } from "../../plugins/builtin/index.js";
import {
  mergeConfiguredPluginEntries,
  normalizeLegacyExtensionEntries,
} from "../../plugins/legacy-extensions.js";
import {
  parsePluginManifest,
  readAndValidatePluginManifest,
} from "../../plugins/manifest-schema.js";
import type { PluginCategory } from "../../plugins/categories.js";
import type { InstalledPluginCatalog, InstalledPluginCatalogEntry } from "../../plugins/types.js";
import type { LoadedProjectConfig } from "../project-config.js";
import {
  getProjectPluginCatalogPath,
  getUserPluginCatalogPath,
  getUserPluginsRoot,
} from "../../plugins/paths.js";

export type PluginListSource = "builtin" | "local" | "configured";

export type PluginListItem = {
  id: string;
  name: string;
  version: string;
  category: PluginCategory;
  source: PluginListSource;
  enabled: boolean;
  path: string;
  tools: string[];
  skillLoaders: string[];
  modelHosts: string[];
};

export type PluginMutationResult = {
  ok: true;
  id: string;
  requiresRestart: true;
};

export type PluginDoctorIssue = {
  code: "missing_path" | "invalid_manifest" | "duplicate_id" | "stale_config_ref" | "id_mismatch";
  severity: "error" | "warning";
  message: string;
  pluginId?: string | undefined;
  path?: string | undefined;
};

export type PluginRegistryServiceOptions = {
  projectRoot: string;
  loadedConfig: LoadedProjectConfig;
  /** Override user catalog path (tests). */
  userCatalogPath?: string | undefined;
  /** Override user install root (tests). */
  userPluginsRoot?: string | undefined;
};

const REGISTER_CANDIDATES = [
  "register.ts",
  "register.js",
  "register.mjs",
  "register.cjs",
  "index.ts",
  "index.js",
  "index.mjs",
  "index.cjs",
] as const;

export class PluginRegistryService {
  private readonly projectRoot: string;
  private readonly configFilePath: string;
  private readonly allowlistPath: string | undefined;
  private readonly legacyExtensions: Array<{ path: string; agents: string[] }>;
  private readonly userCatalogPath: string;
  private readonly userPluginsRoot: string;
  private readonly projectCatalogPath: string;

  constructor(options: PluginRegistryServiceOptions) {
    this.projectRoot = options.projectRoot;
    this.configFilePath = options.loadedConfig.path ?? join(options.projectRoot, "rlm.config.yaml");
    this.legacyExtensions = options.loadedConfig.config.extensions?.load ?? [];
    const configuredAllowlist = options.loadedConfig.config.extensions?.allowlist;
    this.allowlistPath = configuredAllowlist
      ? isAbsolute(configuredAllowlist)
        ? configuredAllowlist
        : resolve(dirname(this.configFilePath), configuredAllowlist)
      : join(dirname(this.configFilePath), ".rlm-allowlist.json");
    this.userCatalogPath = options.userCatalogPath ?? getUserPluginCatalogPath();
    this.userPluginsRoot = options.userPluginsRoot ?? getUserPluginsRoot();
    this.projectCatalogPath = getProjectPluginCatalogPath(options.projectRoot);
  }

  async list(): Promise<PluginListItem[]> {
    const items: PluginListItem[] = [];
    const seen = new Set<string>();

    for (const builtin of BUILTIN_PLUGINS) {
      const manifest = parsePluginManifest(builtin.manifest, builtin.path);
      items.push(
        this.toListItem(manifest, {
          source: "builtin",
          enabled: true,
          path: builtin.path,
        }),
      );
      seen.add(manifest.id);
    }

    for (const catalogPath of [this.userCatalogPath, this.projectCatalogPath]) {
      const catalog = await readCatalog(catalogPath);
      for (const entry of catalog.plugins ?? []) {
        if (seen.has(entry.id)) {
          continue;
        }

        const manifest = await this.readManifestForEntry(entry);
        items.push(
          this.toListItem(manifest, {
            source: "local",
            enabled: entry.enabled,
            path: entry.path,
          }),
        );
        seen.add(entry.id);
      }
    }

    const configured = mergeConfiguredPluginEntries(this.legacyExtensions, this.configFilePath);
    for (const entry of configured) {
      if (seen.has(entry.id)) {
        continue;
      }

      const manifest = await this.readManifestForNormalizedEntry(entry);
      items.push(
        this.toListItem(manifest, {
          source: "configured",
          enabled: entry.enabled,
          path: entry.path,
        }),
      );
      seen.add(entry.id);
    }

    return items.sort((left, right) => left.id.localeCompare(right.id));
  }

  async installLocal(sourcePathInput: string): Promise<PluginMutationResult> {
    const sourcePath = resolve(this.projectRoot, sourcePathInput);
    await assertPathExists(sourcePath, "Plugin source path not found");

    const { root, entryPath } = await resolvePluginLayout(sourcePath);
    const manifestPath = join(root, "rlm.plugin.json");
    const manifest = await readAndValidatePluginManifest(manifestPath);
    const installDir = join(this.userPluginsRoot, manifest.id);
    const installedEntryPath = join(installDir, basename(entryPath));

    await rm(installDir, { recursive: true, force: true });
    await mkdir(dirname(installDir), { recursive: true });
    await cp(root, installDir, { recursive: true, force: true });

    await this.preApproveTrustGate(installedEntryPath);

    const catalog = await readCatalog(this.userCatalogPath);
    const nextEntry: InstalledPluginCatalogEntry = {
      id: manifest.id,
      path: installedEntryPath,
      enabled: true,
      source: "local",
    };
    const plugins = (catalog.plugins ?? []).filter((entry) => entry.id !== manifest.id);
    plugins.push(nextEntry);
    await writeCatalog(this.userCatalogPath, { plugins });

    return { ok: true, id: manifest.id, requiresRestart: true };
  }

  async enable(pluginId: string): Promise<PluginMutationResult> {
    await this.setEnabled(pluginId, true);
    return { ok: true, id: pluginId, requiresRestart: true };
  }

  async disable(pluginId: string): Promise<PluginMutationResult> {
    await this.setEnabled(pluginId, false);
    return { ok: true, id: pluginId, requiresRestart: true };
  }

  async uninstall(pluginId: string): Promise<PluginMutationResult> {
    if (BUILTIN_PLUGINS.some((builtin) => builtin.manifest.id === pluginId)) {
      throw new Error(`Cannot uninstall built-in plugin: ${pluginId}`);
    }

    let removed = false;
    for (const catalogPath of [this.userCatalogPath, this.projectCatalogPath]) {
      const catalog = await readCatalog(catalogPath);
      const next = (catalog.plugins ?? []).filter((entry) => entry.id !== pluginId);
      if (next.length !== (catalog.plugins ?? []).length) {
        removed = true;
        if (next.length === 0) {
          await rm(catalogPath, { force: true });
        } else {
          await writeCatalog(catalogPath, { plugins: next });
        }
      }
    }

    const installDir = join(this.userPluginsRoot, pluginId);
    if (await pathExists(installDir)) {
      await rm(installDir, { recursive: true, force: true });
      removed = true;
    }

    await this.removeStaleConfigRefs(pluginId);

    if (!removed) {
      throw new Error(`Plugin not installed: ${pluginId}`);
    }

    return { ok: true, id: pluginId, requiresRestart: true };
  }

  async doctor(): Promise<{ ok: boolean; issues: PluginDoctorIssue[] }> {
    const issues: PluginDoctorIssue[] = [];
    const ids = new Map<string, string>();

    for (const catalogPath of [this.userCatalogPath, this.projectCatalogPath]) {
      const catalog = await readCatalog(catalogPath);
      for (const entry of catalog.plugins ?? []) {
        if (ids.has(entry.id)) {
          issues.push({
            code: "duplicate_id",
            severity: "error",
            message: `Duplicate plugin id ${entry.id} in catalogs`,
            pluginId: entry.id,
          });
        } else {
          ids.set(entry.id, catalogPath);
        }

        if (!(await pathExists(entry.path))) {
          issues.push({
            code: "missing_path",
            severity: "error",
            message: `Plugin path missing for ${entry.id}: ${entry.path}`,
            pluginId: entry.id,
            path: entry.path,
          });
          continue;
        }

        try {
          const manifest = await this.readManifestForEntry(entry);
          if (manifest.id !== entry.id) {
            issues.push({
              code: "id_mismatch",
              severity: "error",
              message: `Catalog id ${entry.id} does not match manifest id ${manifest.id}`,
              pluginId: entry.id,
              path: entry.path,
            });
          }
        } catch (error: unknown) {
          issues.push({
            code: "invalid_manifest",
            severity: "error",
            message: error instanceof Error ? error.message : String(error),
            pluginId: entry.id,
            path: entry.path,
          });
        }
      }
    }

    const configured = normalizeLegacyExtensionEntries(this.legacyExtensions, this.configFilePath);
    for (const entry of configured) {
      if (!(await pathExists(entry.path))) {
        issues.push({
          code: "stale_config_ref",
          severity: "error",
          message: `Configured extension path missing: ${entry.path}`,
          pluginId: entry.id,
          path: entry.path,
        });
      }
    }

    const hasErrors = issues.some((issue) => issue.severity === "error");
    return { ok: !hasErrors, issues };
  }

  async inspect(
    pluginId: string,
  ): Promise<{ manifest: ReturnType<typeof parsePluginManifest>; path: string }> {
    const builtin = BUILTIN_PLUGINS.find((entry) => entry.manifest.id === pluginId);
    if (builtin) {
      return {
        manifest: parsePluginManifest(builtin.manifest, builtin.path),
        path: builtin.path,
      };
    }

    for (const catalogPath of [this.userCatalogPath, this.projectCatalogPath]) {
      const catalog = await readCatalog(catalogPath);
      const entry = (catalog.plugins ?? []).find((candidate) => candidate.id === pluginId);
      if (entry) {
        const manifest = await this.readManifestForEntry(entry);
        return { manifest, path: entry.path };
      }
    }

    const configured = mergeConfiguredPluginEntries(this.legacyExtensions, this.configFilePath);
    const match = configured.find((entry) => entry.id === pluginId);
    if (match) {
      const manifest = await this.readManifestForNormalizedEntry(match);
      return { manifest, path: match.path };
    }

    throw new Error(`Unknown plugin id: ${pluginId}`);
  }

  async validatePath(pathInput: string): Promise<ReturnType<typeof parsePluginManifest>> {
    const absPath = resolve(this.projectRoot, pathInput);
    await assertPathExists(absPath, "Plugin path not found");
    const { root } = await resolvePluginLayout(absPath);
    return readAndValidatePluginManifest(join(root, "rlm.plugin.json"));
  }

  getCatalogPaths(): string[] {
    return [this.userCatalogPath, this.projectCatalogPath];
  }

  private async setEnabled(pluginId: string, enabled: boolean): Promise<void> {
    if (BUILTIN_PLUGINS.some((builtin) => builtin.manifest.id === pluginId)) {
      throw new Error(`Built-in plugin enablement is fixed: ${pluginId}`);
    }

    let updated = false;
    for (const catalogPath of [this.userCatalogPath, this.projectCatalogPath]) {
      const catalog = await readCatalog(catalogPath);
      const plugins = catalog.plugins ?? [];
      const index = plugins.findIndex((entry) => entry.id === pluginId);
      if (index >= 0) {
        plugins[index] = { ...plugins[index]!, enabled };
        await writeCatalog(catalogPath, { plugins });
        updated = true;
      }
    }

    if (!updated) {
      throw new Error(`Plugin not installed: ${pluginId}`);
    }
  }

  private async preApproveTrustGate(entryPath: string): Promise<void> {
    if (!this.allowlistPath) {
      return;
    }

    const allowlist = await readAllowlist(this.allowlistPath);
    allowlist[allowlistKey(entryPath)] = entryPath;
    await writeAllowlist(this.allowlistPath, allowlist);
  }

  private async removeStaleConfigRefs(_pluginId: string): Promise<void> {
    // Catalog is the source of truth for installed plugins; doctor reports stale YAML refs.
  }

  private toListItem(
    manifest: ReturnType<typeof parsePluginManifest>,
    details: Pick<PluginListItem, "source" | "enabled" | "path">,
  ): PluginListItem {
    return {
      id: manifest.id,
      name: manifest.name,
      version: manifest.version,
      category: manifest.category,
      source: details.source,
      enabled: details.enabled,
      path: details.path,
      tools: manifest.contributes.tools,
      skillLoaders: manifest.contributes.skillLoaders,
      modelHosts: manifest.contributes.modelHosts,
    };
  }

  private async readManifestForEntry(entry: InstalledPluginCatalogEntry) {
    const manifestPath = join(dirname(entry.path), "rlm.plugin.json");
    if (await pathExists(manifestPath)) {
      return readAndValidatePluginManifest(manifestPath);
    }

    return parsePluginManifest(
      {
        id: entry.id,
        name: basename(dirname(entry.path)),
        version: "0.0.0",
        category: "interop",
        contributes: { tools: [], skillLoaders: [], modelHosts: [] },
        engines: { rlm: ">=1.0.0" },
      },
      entry.path,
    );
  }

  private async readManifestForNormalizedEntry(entry: {
    id: string;
    path: string;
  }): Promise<ReturnType<typeof parsePluginManifest>> {
    const manifestPath = join(dirname(entry.path), "rlm.plugin.json");
    if (await pathExists(manifestPath)) {
      return readAndValidatePluginManifest(manifestPath);
    }

    return parsePluginManifest(
      {
        id: entry.id,
        name: basename(entry.path),
        version: "0.0.0",
        category: "interop",
        contributes: { tools: [], skillLoaders: [], modelHosts: [] },
        engines: { rlm: ">=1.0.0" },
      },
      entry.path,
    );
  }
}

async function resolvePluginLayout(
  sourcePath: string,
): Promise<{ root: string; entryPath: string }> {
  const sourceStat = await stat(sourcePath);
  if (sourceStat.isFile()) {
    return { root: dirname(sourcePath), entryPath: sourcePath };
  }

  const manifestPath = join(sourcePath, "rlm.plugin.json");
  if (!(await pathExists(manifestPath))) {
    throw new Error(`Missing rlm.plugin.json in plugin directory: ${sourcePath}`);
  }

  for (const candidate of REGISTER_CANDIDATES) {
    const entryPath = join(sourcePath, candidate);
    if (await pathExists(entryPath)) {
      return { root: sourcePath, entryPath };
    }
  }

  const files = await readdir(sourcePath);
  const dynamic = files.find((file) => /\.(mjs|cjs|js|ts)$/u.test(file));
  if (dynamic) {
    return { root: sourcePath, entryPath: join(sourcePath, dynamic) };
  }

  throw new Error(
    `No register module found in ${sourcePath}. Expected one of: ${REGISTER_CANDIDATES.join(", ")}`,
  );
}

async function readCatalog(path: string): Promise<InstalledPluginCatalog> {
  try {
    return JSON.parse(await readFile(path, "utf8")) as InstalledPluginCatalog;
  } catch (error: unknown) {
    if (isEnoent(error)) {
      return { plugins: [] };
    }

    throw error;
  }
}

async function writeCatalog(path: string, catalog: InstalledPluginCatalog): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(catalog, null, 2)}\n`, "utf8");
}

async function readAllowlist(path: string): Promise<Record<string, string>> {
  try {
    return JSON.parse(await readFile(path, "utf8")) as Record<string, string>;
  } catch (error: unknown) {
    if (isEnoent(error)) {
      return {};
    }

    throw error;
  }
}

async function writeAllowlist(path: string, allowlist: Record<string, string>): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(allowlist, null, 2)}\n`, "utf8");
}

function allowlistKey(absPath: string): string {
  return createHash("sha256").update(absPath).digest("hex");
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function assertPathExists(path: string, message: string): Promise<void> {
  if (!(await pathExists(path))) {
    throw new Error(`${message}: ${path}`);
  }
}

function isEnoent(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}

export function createPluginRegistryService(
  options: PluginRegistryServiceOptions,
): PluginRegistryService {
  return new PluginRegistryService(options);
}
