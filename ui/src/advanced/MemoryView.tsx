import { useCallback, useEffect, useState } from "react";
import type { MemorySnapshot } from "../shared/types";
import { MemoryPanel } from "./memory/MemoryPanel";

export function MemoryView({
  setErrorMessage,
}: {
  setErrorMessage: (message: string | undefined) => void;
}) {
  const [memory, setMemory] = useState<MemorySnapshot | undefined>();

  const refresh = useCallback(async () => {
    const response = await fetch("/api/memory");
    if (!response.ok) {
      return;
    }
    setMemory((await response.json()) as MemorySnapshot);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return <MemoryPanel memory={memory} refresh={refresh} setErrorMessage={setErrorMessage} />;
}
