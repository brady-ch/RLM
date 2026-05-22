import { useEffect } from "react";
import type { SavedSessionRecord, SavedSessionSummary } from "../shared/types";
import { SavedSessionPanel } from "../legacy/panels";

export type SessionsViewProps = {
  sessions: SavedSessionSummary[];
  detail: SavedSessionRecord | undefined;
  setDetail: (record: SavedSessionRecord | undefined) => void;
  refresh: () => Promise<void>;
  setErrorMessage: (message: string | undefined) => void;
  onMount: () => void;
};

export function SessionsView(props: SessionsViewProps) {
  const { onMount, ...panelProps } = props;
  useEffect(() => {
    onMount();
  }, [onMount]);
  return <SavedSessionPanel {...panelProps} />;
}
