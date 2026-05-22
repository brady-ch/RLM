import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, resolve } from "node:path";
import * as readline from "node:readline/promises";
import { pathToFileURL } from "node:url";
import type { ExtensionRegistryEntry } from "../ports/extension-port.js";
import type { LanguageModelPort } from "../ports/language-model-port.js";
import type { SkillLoaderPort } from "../ports/skill-loader-port.js";
import type { ToolPort } from "../ports/tool-port.js";

type NamedModelHost = LanguageModelPort & { name: string };
type ExtensionModule = { register?: unknown };
type Allowlist = Record<string, string>;

export class ExtensionHost {
  private readonly toolRegistry = new Map<string, ToolPort>();
  private readonly skillLoaderRegistry = new Map<string, SkillLoaderPort>();
  private readonly modelHostRegistry = new Map<string, NamedModelHost>();

  readonly tools = {
    register: (tool: ToolPort): void => {
      registerUnique(this.toolRegistry, tool.name, tool, "tool");
    },
    get: (name: string): ToolPort | undefined => this.toolRegistry.get(name),
    all: (): ToolPort[] => [...this.toolRegistry.values()],
  };

  readonly skillLoaders = {
    register: (loader: SkillLoaderPort): void => {
      registerUnique(this.skillLoaderRegistry, loader.name, loader, "skill loader");
    },
    get: (name: string): SkillLoaderPort | undefined => this.skillLoaderRegistry.get(name),
  };

  readonly modelHosts = {
    register: (adapter: NamedModelHost): void => {
      registerUnique(this.modelHostRegistry, adapter.name, adapter, "model host");
    },
    get: (name: string): LanguageModelPort | undefined => this.modelHostRegistry.get(name),
  };

  loadBuiltins(entries: Array<{ path: string; register: (host: ExtensionHost) => void }>): void {
    for (const entry of entries) {
      entry.register(this);
    }
  }

  async loadExternal(
    entries: ExtensionRegistryEntry[],
    opts: { configFilePath: string; allowlistPath?: string; interactive?: boolean },
  ): Promise<void> {
    const configDir = dirname(opts.configFilePath);
    const allowlistPath = opts.allowlistPath ?? join(configDir, ".rlm-allowlist.json");

    for (const entry of entries) {
      const absPath = isAbsolute(entry.path) ? entry.path : resolve(configDir, entry.path);
      const key = allowlistKey(absPath);
      const allowlist = await readAllowlist(allowlistPath);

      if (!Object.hasOwn(allowlist, key)) {
        if (opts.interactive === false) {
          throw new Error(`Extension not approved and interactive=false: ${absPath}`);
        }

        const approved = await promptForApproval(absPath);
        if (!approved) {
          throw new Error(`Extension not approved: ${absPath}`);
        }

        allowlist[key] = absPath;
        await writeAllowlist(allowlistPath, allowlist);
      }

      const fileUrl = pathToFileURL(absPath).href;
      let mod: ExtensionModule;
      try {
        mod = (await import(fileUrl)) as ExtensionModule;
      } catch (error: unknown) {
        const cause = error instanceof Error ? error.message : String(error);
        throw new Error(`Failed to load extension at ${absPath}: ${cause}`);
      }

      if (typeof mod.register !== "function") {
        throw new Error(`Extension at ${absPath} does not export a "register" function.`);
      }

      mod.register(this);
    }
  }

  async preApprove(absPath: string, allowlistPath: string): Promise<void> {
    const allowlist = await readAllowlist(allowlistPath);
    allowlist[allowlistKey(absPath)] = absPath;
    await writeAllowlist(allowlistPath, allowlist);
  }
}

function registerUnique<T>(registry: Map<string, T>, name: string, value: T, label: string): void {
  if (registry.has(name)) {
    throw new Error(`Duplicate ${label} registration: ${name}`);
  }

  registry.set(name, value);
}

function allowlistKey(absPath: string): string {
  return createHash("sha256").update(absPath).digest("hex");
}

async function readAllowlist(path: string): Promise<Allowlist> {
  try {
    return JSON.parse(await readFile(path, "utf8")) as Allowlist;
  } catch (error: unknown) {
    if (isNodeError(error) && error.code === "ENOENT") {
      return {};
    }

    throw error;
  }
}

async function writeAllowlist(path: string, allowlist: Allowlist): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(allowlist, null, 2)}\n`, "utf8");
}

async function promptForApproval(absPath: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    const answer = await rl.question(`Allow extension at ${absPath}? [y/N] `);
    return ["y", "yes"].includes(answer.trim().toLowerCase());
  } finally {
    rl.close();
  }
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
