import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import {
  cycleThemePreference,
  getStoredThemePreference,
  getSystemTheme,
  resolveTheme,
  setThemePreference,
  themePreferenceLabel,
  type ResolvedTheme,
  type ThemePreference,
} from "./theme";

export function ThemeToggle() {
  const [preference, setPreference] = useState<ThemePreference>(() => getStoredThemePreference());
  const [resolved, setResolved] = useState<ResolvedTheme>(() =>
    resolveTheme(getStoredThemePreference()),
  );

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if (getStoredThemePreference() === "system") {
        const next = getSystemTheme();
        setResolved(next);
      }
    };
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  const toggle = () => {
    const nextPreference = cycleThemePreference(preference);
    const nextResolved = setThemePreference(nextPreference);
    setPreference(nextPreference);
    setResolved(nextResolved);
  };

  const label = themePreferenceLabel(preference, resolved);
  const Icon = resolved === "dark" ? Moon : Sun;

  return (
    <button
      type="button"
      className="btn-topbar-secondary theme-toggle"
      aria-label={`Theme: ${label}. Click to change.`}
      title={`Theme: ${label}`}
      onClick={toggle}
    >
      <Icon size={16} aria-hidden />
      <span className="theme-toggle-label">{label}</span>
    </button>
  );
}
