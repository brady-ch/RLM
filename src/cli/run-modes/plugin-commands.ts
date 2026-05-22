import { loadProjectConfig } from "../../application/project-config.js";
import {
  createPluginRegistryService,
  type PluginDoctorIssue,
  type PluginListItem,
} from "../../application/plugins/index.js";
import type { CliOptions } from "../args.js";

export async function handlePluginCommands(options: CliOptions): Promise<boolean> {
  if (options.command !== "plugin" || !options.pluginSubcommand) {
    return false;
  }

  const cwd = process.cwd();
  const loadedConfig = await loadProjectConfig(options.configPath);
  const registry = createPluginRegistryService({ projectRoot: cwd, loadedConfig });

  try {
    switch (options.pluginSubcommand) {
      case "list":
        await runList(registry, options.json);
        return true;
      case "install":
        await runInstall(registry, options.pluginTarget, options.json);
        return true;
      case "enable":
        await runMutation(registry, "enable", options.pluginTarget, options.json);
        return true;
      case "disable":
        await runMutation(registry, "disable", options.pluginTarget, options.json);
        return true;
      case "uninstall":
        await runMutation(registry, "uninstall", options.pluginTarget, options.json);
        return true;
      case "doctor":
        await runDoctor(registry, options.json);
        return true;
      case "inspect":
        await runInspect(registry, options.pluginTarget, options.json);
        return true;
      case "validate":
        await runValidate(registry, options.pluginTarget, options.json);
        return true;
      default:
        throw new Error(`Unknown plugin subcommand: ${options.pluginSubcommand}`);
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    if (options.json) {
      console.log(JSON.stringify({ ok: false, error: message }, null, 2));
    } else {
      console.error(`Plugin command failed: ${message}`);
    }
    process.exitCode = 1;
    return true;
  }
}

async function runList(
  registry: ReturnType<typeof createPluginRegistryService>,
  json: boolean,
): Promise<void> {
  const plugins = await registry.list();
  if (json) {
    console.log(JSON.stringify({ plugins }, null, 2));
    return;
  }

  if (plugins.length === 0) {
    console.log("No plugins found.");
    return;
  }

  for (const plugin of plugins) {
    console.log(formatPluginLine(plugin));
  }
}

async function runInstall(
  registry: ReturnType<typeof createPluginRegistryService>,
  target: string | undefined,
  json: boolean,
): Promise<void> {
  if (!target) {
    throw new Error("Missing plugin path. Example: rlm plugin install ./my-plugin");
  }

  const result = await registry.installLocal(target);
  emitMutation(result, json, `Installed plugin ${result.id}. Restart RLM to load it.`);
}

async function runMutation(
  registry: ReturnType<typeof createPluginRegistryService>,
  action: "enable" | "disable" | "uninstall",
  target: string | undefined,
  json: boolean,
): Promise<void> {
  if (!target) {
    throw new Error(`Missing plugin id. Example: rlm plugin ${action} <id>`);
  }

  const result =
    action === "enable"
      ? await registry.enable(target)
      : action === "disable"
        ? await registry.disable(target)
        : await registry.uninstall(target);

  const message =
    action === "uninstall"
      ? `Uninstalled plugin ${result.id}. Restart RLM to apply.`
      : `${action === "enable" ? "Enabled" : "Disabled"} plugin ${result.id}. Restart RLM to apply.`;
  emitMutation(result, json, message);
}

async function runDoctor(
  registry: ReturnType<typeof createPluginRegistryService>,
  json: boolean,
): Promise<void> {
  const report = await registry.doctor();
  if (json) {
    console.log(JSON.stringify(report, null, 2));
  } else if (report.ok) {
    console.log("Plugin doctor: no issues found.");
  } else {
    for (const issue of report.issues) {
      console.log(formatDoctorIssue(issue));
    }
  }

  if (!report.ok) {
    process.exitCode = 1;
  }
}

async function runInspect(
  registry: ReturnType<typeof createPluginRegistryService>,
  target: string | undefined,
  json: boolean,
): Promise<void> {
  if (!target) {
    throw new Error("Missing plugin id. Example: rlm plugin inspect rlm.builtin.shell");
  }

  const inspected = await registry.inspect(target);
  if (json) {
    console.log(JSON.stringify(inspected, null, 2));
    return;
  }

  console.log(`Plugin: ${inspected.manifest.id}`);
  console.log(`Path: ${inspected.path}`);
  console.log(JSON.stringify(inspected.manifest, null, 2));
}

async function runValidate(
  registry: ReturnType<typeof createPluginRegistryService>,
  target: string | undefined,
  json: boolean,
): Promise<void> {
  if (!target) {
    throw new Error("Missing plugin path. Example: rlm plugin validate ./my-plugin");
  }

  const manifest = await registry.validatePath(target);
  if (json) {
    console.log(JSON.stringify({ ok: true, manifest }, null, 2));
    return;
  }

  console.log(`Valid manifest for ${manifest.id}@${manifest.version}`);
}

function emitMutation(
  result: { ok: true; id: string; requiresRestart: true },
  json: boolean,
  message: string,
): void {
  if (json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.log(message);
}

function formatPluginLine(plugin: PluginListItem): string {
  const tools = plugin.tools.join(", ") || "(none)";
  return `${plugin.id} [${plugin.category}] source=${plugin.source} enabled=${plugin.enabled} tools=${tools}`;
}

function formatDoctorIssue(issue: PluginDoctorIssue): string {
  const prefix = issue.severity === "error" ? "ERROR" : "WARN";
  return `${prefix} ${issue.code}: ${issue.message}`;
}
