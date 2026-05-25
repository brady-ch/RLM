import { useCallback, useEffect, useState } from "react";
import type { SavedSessionSummary } from "../../shared/types";

export function useLauncherSessions(showLauncher: boolean) {
  const [savedSessions, setSavedSessions] = useState<SavedSessionSummary[]>([]);

  const refreshSavedSessions = useCallback(async () => {
    const response = await fetch("/api/saved-sessions");
    if (!response.ok) {
      return;
    }
    const payload = (await response.json()) as { sessions: SavedSessionSummary[] };
    setSavedSessions(payload.sessions);
  }, []);

  useEffect(() => {
    if (showLauncher) {
      void refreshSavedSessions();
    }
  }, [showLauncher, refreshSavedSessions]);

  return { savedSessions, refreshSavedSessions };
}
