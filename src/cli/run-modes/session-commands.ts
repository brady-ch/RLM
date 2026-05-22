import type { FileMemoryStore, FileSessionStore } from "../../adapters/index.js";
import { MemoryResolver } from "../../application/memory-resolver.js";
import type { CliOptions } from "../args.js";

export function parsePreferenceAssignment(value: string): { key: string; value: string } {
  const separator = value.indexOf("=");
  if (separator <= 0) {
    throw new Error("--preference-set must use key=value.");
  }
  const key = value.slice(0, separator).trim();
  const preferenceValue = value.slice(separator + 1).trim();
  if (!key || !preferenceValue) {
    throw new Error("--preference-set requires non-empty key and value.");
  }
  return { key, value: preferenceValue };
}

/**
 * Handles session/memory/preference subcommands before config load.
 * @returns true if the CLI should exit afterward.
 */
export async function handleSessionCommands(
  options: CliOptions,
  sessionStore: FileSessionStore,
  memoryStore: FileMemoryStore,
): Promise<boolean> {
  if (options.sessionList) {
    console.log(JSON.stringify({ sessions: await sessionStore.list() }, null, 2));
    return true;
  }
  if (options.sessionInspect) {
    console.log(JSON.stringify(await sessionStore.inspect(options.sessionInspect), null, 2));
    return true;
  }
  if (options.memoryInspect) {
    const inspector = new MemoryResolver(memoryStore, { sessionId: options.memoryInspect });
    console.log(JSON.stringify(await inspector.inspect(), null, 2));
    return true;
  }
  if (options.preferenceSet) {
    const { key, value } = parsePreferenceAssignment(options.preferenceSet);
    const preferences = new MemoryResolver(memoryStore, { sessionId: "preferences-cli" });
    await preferences.setPreference({ key, value, source: "cli", lifetime: "project" });
    console.log(JSON.stringify(await preferences.inspect(), null, 2));
    return true;
  }
  if (options.preferenceDelete) {
    const preferences = new MemoryResolver(memoryStore, { sessionId: "preferences-cli" });
    await preferences.deletePreference({ key: options.preferenceDelete });
    console.log(JSON.stringify(await preferences.inspect(), null, 2));
    return true;
  }
  return false;
}
