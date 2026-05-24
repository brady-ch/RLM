import { useEffect } from "react";
import type { PluginSnapshot } from "../shared/types";
import { PluginPanel } from "./PluginPanel";

export type PluginsViewProps = {
  snapshot: PluginSnapshot;
  restartRequired: boolean;
  setRestartRequired: (value: boolean) => void;
  refresh: () => Promise<void>;
  setErrorMessage: (message: string | undefined) => void;
  onMount: () => void;
};

export function PluginsView(props: PluginsViewProps) {
  const { onMount, ...panelProps } = props;
  useEffect(() => {
    onMount();
  }, [onMount]);
  return <PluginPanel {...panelProps} />;
}
