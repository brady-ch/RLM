import { useCallback, useEffect, useState } from "react";
import type { AdvancedTab } from "../../advanced/AdvancedHub";
import type { SessionSnapshot } from "../../shared/types";
import { isPristineFirstRunGraph } from "../../shared/session-utils";

export function useViewRouter(snapshot: SessionSnapshot) {
  const [viewMode, setViewMode] = useState<"workflow" | "advanced">("workflow");
  const [advancedTab, setAdvancedTab] = useState<AdvancedTab>("settings");
  const [launcherDismissed, setLauncherDismissed] = useState(() => {
    try {
      return sessionStorage.getItem("rlm-workflow-entered") === "1";
    } catch {
      return false;
    }
  });

  const dismissLauncher = useCallback(() => {
    try {
      sessionStorage.setItem("rlm-workflow-entered", "1");
    } catch {
      // sessionStorage unavailable
    }
    setLauncherDismissed(true);
  }, []);

  const showLauncher =
    viewMode === "workflow" && isPristineFirstRunGraph(snapshot) && !launcherDismissed;

  useEffect(() => {
    if (!isPristineFirstRunGraph(snapshot)) {
      setLauncherDismissed(true);
    }
  }, [snapshot]);

  const navigateAdvancedSettings = useCallback(() => {
    setAdvancedTab("settings");
    setViewMode("advanced");
  }, []);

  return {
    viewMode,
    setViewMode,
    advancedTab,
    setAdvancedTab,
    showLauncher,
    dismissLauncher,
    navigateAdvancedSettings,
    launcherDismissed,
  };
}
