import { useCallback, useEffect, useState } from "react";
import type { SessionSnapshot } from "../../shared/types";

const emptySnapshot = (): SessionSnapshot => ({
  graph: { nodes: [], edges: [] },
  status: "planned",
  approvalMode: "full",
  autoApprovalPaused: false,
});

export function useWorkflowSession() {
  const [snapshot, setSnapshot] = useState<SessionSnapshot>(emptySnapshot);

  const refresh = useCallback(async () => {
    const response = await fetch("/api/session");
    if (!response.ok) {
      throw new Error(await response.text());
    }
    setSnapshot((await response.json()) as SessionSnapshot);
  }, []);

  useEffect(() => {
    void refresh();
    const events = new EventSource("/api/events");
    events.addEventListener("snapshot", (event) => {
      try {
        setSnapshot(JSON.parse((event as MessageEvent).data) as SessionSnapshot);
      } catch {
        void refresh();
      }
    });
    events.addEventListener("execution", () => {
      void refresh();
    });
    return () => events.close();
  }, [refresh]);

  return { snapshot, refresh };
}
