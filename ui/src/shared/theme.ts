export type ThemePreference = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

export const THEME_STORAGE_KEY = "rlm-ui-theme";

export function getSystemTheme(): ResolvedTheme {
  if (typeof window === "undefined") {
    return "light";
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function getStoredThemePreference(): ThemePreference {
  if (typeof window === "undefined") {
    return "system";
  }
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === "light" || stored === "dark" || stored === "system") {
      return stored;
    }
  } catch {
    // localStorage unavailable
  }
  return "system";
}

export function resolveTheme(preference: ThemePreference): ResolvedTheme {
  return preference === "system" ? getSystemTheme() : preference;
}

export function applyThemeToDocument(resolved: ResolvedTheme): void {
  document.documentElement.dataset.theme = resolved;
  document.documentElement.style.colorScheme = resolved;
}

export function initThemeFromStorage(): ResolvedTheme {
  const preference = getStoredThemePreference();
  const resolved = resolveTheme(preference);
  applyThemeToDocument(resolved);
  return resolved;
}

export function setThemePreference(preference: ThemePreference): ResolvedTheme {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    // localStorage unavailable
  }
  const resolved = resolveTheme(preference);
  applyThemeToDocument(resolved);
  return resolved;
}

export function cycleThemePreference(current: ThemePreference): ThemePreference {
  if (current === "system") {
    return "light";
  }
  if (current === "light") {
    return "dark";
  }
  return "system";
}

export function themePreferenceLabel(preference: ThemePreference, resolved: ResolvedTheme): string {
  if (preference === "system") {
    return `System (${resolved})`;
  }
  return preference === "light" ? "Light" : "Dark";
}
