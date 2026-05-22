import { readFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import type { ExtensionHostPort } from "../ports/extension-host-port.js";
import type { ExtensionRegistryEntry } from "../ports/extension-port.js";
import { ExtensionHost } from "../runtime/composition/extension-host.js";
import { BUILTIN_PLUGINS, type BuiltinPluginDefinition } from "./builtin/index.js";
import { mergeConfiguredPluginEntries } from "./legacy-extensions.js";
import { parsePluginManifest, readAndValidatePluginManifest } from "./manifest-schema.js";
import type { InstalledPluginCatalog, NormalizedPluginEntry, PluginDescriptor } from "./types.js";

export type PluginLoadOptions = {
  cwd: string;
  configFilePath: string;
  legacyExtensions?: ExtensionRegistryEntry[] | undefined;
  pluginEntries?: NormalizedPluginEntry[] | undefined;
  allowlistPath?: string | undefined;
  interactive?: boolean | undefined;
  /** @deprecated Prefer catalogPaths */
  catalogPath?: string | undefined;
  catalogPaths?: string[] | undefined;
};

export class PluginLoader {
  private readonly descriptors: PluginDescriptor[] = [];
  private readonly loadedCatalogIds = new Set<string>();

  listPlugins(): PluginDescriptor[] {
    return [...this.descriptors];
  }

  formatListOutput(): string {
    if (this.descriptors.length === 0) {
      return "No plugins loaded.";
    }

    return this.descriptors
      .map((plugin) => {
        const tools = plugin.contributes.tools.join(", ") || "(none)";
        return `${plugin.id} [${plugin.category}] source=${plugin.source} enabled=${plugin.enabled} tools=${tools}`;
      })
      .join("\n");
  }

  async loadInto(host: ExtensionHostPort, options: PluginLoadOptions): Promise<void> {
    this.descriptors.length = 0;
    this.loadedCatalogIds.clear();

    if (!(host instanceof ExtensionHost)) {
      throw new Error("PluginLoader requires ExtensionHost for external plugin loading.");
    }

    for (const builtin of BUILTIN_PLUGINS) {
      this.loadBuiltin(host, builtin);
    }

    const configured = mergeConfiguredPluginEntries(
      options.legacyExtensions ?? [],
      options.configFilePath,
      options.pluginEntries ?? [],
    );
    if (configured.length > 0) {
      await this.loadConfiguredEntries(host, configured, options);
    }

    const catalogPaths =
      options.catalogPaths ??
      (options.catalogPath
        ? [options.catalogPath]
        : [join(options.cwd, ".rlm", "plugins", "catalog.json")]);
    for (const catalogPath of catalogPaths) {
      await this.loadInstalledCatalog(host, catalogPath, options);
    }
  }

  private loadBuiltin(host: ExtensionHostPort, builtin: BuiltinPluginDefinition): void {
    parsePluginManifest(builtin.manifest, builtin.path);
    builtin.register(host);
    this.recordDescriptor(builtin.manifest, {
      source: "builtin",
      path: builtin.path,
      enabled: true,
    });
  }

  private async loadConfiguredEntries(
    host: ExtensionHost,
    entries: NormalizedPluginEntry[],
    options: PluginLoadOptions,
  ): Promise<void> {
    for (const entry of entries) {
      if (!entry.enabled) {
        const manifest = await this.resolveManifest(entry);
        this.recordDescriptor(manifest, {
          source: "configured",
          path: entry.path,
          enabled: false,
        });
        continue;
      }

      await this.loadExternalEntry(host, entry, options);
    }
  }

  private async loadInstalledCatalog(
    host: ExtensionHost,
    catalogPath: string,
    options: PluginLoadOptions,
  ): Promise<void> {
    let catalog: InstalledPluginCatalog;
    try {
      catalog = JSON.parse(await readFile(catalogPath, "utf8")) as InstalledPluginCatalog;
    } catch (error: unknown) {
      if (isEnoent(error)) {
        return;
      }

      throw error;
    }

    for (const entry of catalog.plugins ?? []) {
      if (this.loadedCatalogIds.has(entry.id)) {
        continue;
      }
      this.loadedCatalogIds.add(entry.id);

      const normalized: NormalizedPluginEntry = {
        id: entry.id,
        path: entry.path,
        agents: [],
        source: "installed",
        enabled: entry.enabled,
      };

      if (!entry.enabled) {
        const manifest = await this.resolveManifest(normalized);
        this.recordDescriptor(manifest, {
          source: "installed",
          path: entry.path,
          enabled: false,
        });
        continue;
      }

      await this.loadExternalEntry(host, normalized, options);
    }
  }

  private async loadExternalEntry(
    host: ExtensionHost,
    entry: NormalizedPluginEntry,
    options: PluginLoadOptions,
  ): Promise<void> {
    const manifest = await this.resolveManifest(entry);

    if (manifest.id !== entry.id && entry.source === "installed") {
      throw new Error(
        `Plugin id mismatch for ${entry.path}: catalog id ${entry.id} != manifest id ${manifest.id}`,
      );
    }

    await host.loadExternal([{ path: entry.path, agents: entry.agents }], {
      configFilePath: options.configFilePath,
      ...(options.allowlistPath ? { allowlistPath: options.allowlistPath } : {}),
      interactive: options.interactive ?? false,
    });

    this.recordDescriptor(manifest, {
      source: entry.source,
      path: entry.path,
      enabled: true,
    });
  }

  private async resolveManifest(entry: NormalizedPluginEntry) {
    const manifestPath = join(dirname(entry.path), "rlm.plugin.json");
    try {
      await readFile(manifestPath);
    } catch (error: unknown) {
      if (isEnoent(error)) {
        return parsePluginManifest(synthesizeLegacyManifest(entry), entry.path);
      }

      throw error;
    }

    return readAndValidatePluginManifest(manifestPath);
  }

  private recordDescriptor(
    manifest: ReturnType<typeof parsePluginManifest>,
    details: Pick<PluginDescriptor, "source" | "path" | "enabled">,
  ): void {
    this.descriptors.push({
      id: manifest.id,
      name: manifest.name,
      version: manifest.version,
      category: manifest.category,
      contributes: manifest.contributes,
      ...details,
    });
  }
}

function synthesizeLegacyManifest(entry: NormalizedPluginEntry) {
  return {
    id: entry.id,
    name: basename(entry.path),
    version: "0.0.0",
    category: "interop" as const,
    contributes: {
      tools: [] as string[],
      skillLoaders: [] as string[],
      modelHosts: [] as string[],
    },
    engines: {
      rlm: ">=1.0.0",
    },
  };
}

function isEnoent(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}
