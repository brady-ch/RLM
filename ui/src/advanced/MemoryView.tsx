import { useEffect } from "react";
import type { MemorySnapshot } from "../shared/types";
import { MemoryPanel } from "./memory/MemoryPanel";

export type MemoryViewProps = {
  memory: MemorySnapshot | undefined;
  refresh: () => Promise<void>;
  setErrorMessage: (message: string | undefined) => void;
  onMount: () => void;
};

export function MemoryView(props: MemoryViewProps) {
  const { onMount, ...panelProps } = props;
  useEffect(() => {
    onMount();
  }, [onMount]);
  return <MemoryPanel {...panelProps} />;
}
