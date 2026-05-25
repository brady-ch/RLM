import { useCallback, useEffect, useState } from "react";
import type { PluginDoctorResult, PluginListItem, PluginSnapshot } from "../shared/types";
import { PluginPanel } from "./PluginPanel";

export function PluginsView({
  setErrorMessage,
}: {
  setErrorMessage: (message: string | undefined) => void;
}) {
  const [snapshot, setSnapshot] = useState<PluginSnapshot>({ plugins: [] });
  const [restartRequired, setRestartRequired] = useState(false);

  const refresh = useCallback(async () => {
    const [listResponse, doctorResponse] = await Promise.all([
      fetch("/api/plugins"),
      fetch("/api/plugins/doctor"),
    ]);
    if (!listResponse.ok) {
      return;
    }
    const listPayload = (await listResponse.json()) as { plugins: PluginListItem[] };
    const doctorPayload = doctorResponse.ok
      ? ((await doctorResponse.json()) as PluginDoctorResult)
      : undefined;
    setSnapshot({ plugins: listPayload.plugins, doctor: doctorPayload });
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <PluginPanel
      snapshot={snapshot}
      restartRequired={restartRequired}
      setRestartRequired={setRestartRequired}
      refresh={refresh}
      setErrorMessage={setErrorMessage}
    />
  );
}
