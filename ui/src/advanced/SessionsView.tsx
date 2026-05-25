import { useCallback, useEffect, useState } from "react";
import type { SavedSessionRecord, SavedSessionSummary } from "../shared/types";
import { SavedSessionPanel } from "./sessions/SavedSessionPanel";

export type SessionsViewProps = {
  refreshSession: () => Promise<void>;
  setErrorMessage: (message: string | undefined) => void;
};

export function SessionsView({ refreshSession, setErrorMessage }: SessionsViewProps) {
  const [sessions, setSessions] = useState<SavedSessionSummary[]>([]);
  const [detail, setDetail] = useState<SavedSessionRecord | undefined>();

  const refreshSavedSessions = useCallback(async () => {
    const response = await fetch("/api/saved-sessions");
    if (!response.ok) {
      return;
    }
    const payload = (await response.json()) as { sessions: SavedSessionSummary[] };
    setSessions(payload.sessions);
  }, []);

  const refresh = useCallback(async () => {
    await refreshSession();
    await refreshSavedSessions();
  }, [refreshSavedSessions, refreshSession]);

  useEffect(() => {
    void refreshSavedSessions();
  }, [refreshSavedSessions]);

  return (
    <SavedSessionPanel
      sessions={sessions}
      detail={detail}
      setDetail={setDetail}
      refresh={refresh}
      setErrorMessage={setErrorMessage}
    />
  );
}
