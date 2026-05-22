export const PLUGIN_CATEGORIES = ["shell", "files", "web", "interop"] as const;

export type PluginCategory = (typeof PLUGIN_CATEGORIES)[number];

export function isPluginCategory(value: string): value is PluginCategory {
  return (PLUGIN_CATEGORIES as readonly string[]).includes(value);
}

export function formatPluginCategory(category: PluginCategory): string {
  return category;
}
