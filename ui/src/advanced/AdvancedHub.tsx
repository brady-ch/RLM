import { useState } from "react";
import type { ExecutionNode, SessionSnapshot } from "../shared/types";
import { MemoryView } from "./MemoryView";
import { ModelsView } from "./ModelsView";
import { PluginsView } from "./PluginsView";
import { SessionsView } from "./SessionsView";
import { SettingsView } from "./SettingsView";

export type AdvancedTab = "models" | "plugins" | "sessions" | "memory" | "settings";

export type AdvancedHubProps = {
  onBack: () => void;
  initialTab?: AdvancedTab;
  snapshot: SessionSnapshot;
  selectedNode: ExecutionNode | undefined;
  errorMessage: string | undefined;
  setErrorMessage: (message: string | undefined) => void;
  refresh: () => Promise<void>;
  runVariant: "playbook" | "pipeline";
  setRunVariant: (variant: "playbook" | "pipeline") => void;
  pipelineInput: string;
  setPipelineInput: (value: string) => void;
  planningError: { nodeId: string; message: string } | undefined;
};

export function AdvancedHub({
  onBack,
  initialTab = "models",
  snapshot,
  selectedNode,
  errorMessage,
  setErrorMessage,
  refresh,
  runVariant,
  setRunVariant,
  pipelineInput,
  setPipelineInput,
  planningError,
}: AdvancedHubProps) {
  const [tab, setTab] = useState<AdvancedTab>(initialTab);

  return (
    <div className="advanced-shell" data-testid="advanced-main">
      <header className="advanced-header">
        <button type="button" className="secondary" onClick={onBack}>
          ← Back to workflow
        </button>
        <nav className="advanced-tabs" aria-label="Advanced sections">
          {(
            [
              ["models", "Models"],
              ["sessions", "Sessions"],
              ["plugins", "Plugins"],
              ["memory", "Memory"],
              ["settings", "Settings"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={tab === id ? "active" : undefined}
              aria-current={tab === id ? "page" : undefined}
              onClick={() => setTab(id)}
            >
              {label}
            </button>
          ))}
        </nav>
        {errorMessage ? <p className="error">{errorMessage}</p> : null}
      </header>
      <div className="advanced-content">
        {tab === "models" ? <ModelsView setErrorMessage={setErrorMessage} /> : null}
        {tab === "plugins" ? <PluginsView setErrorMessage={setErrorMessage} /> : null}
        {tab === "sessions" ? (
          <SessionsView refreshSession={refresh} setErrorMessage={setErrorMessage} />
        ) : null}
        {tab === "memory" ? <MemoryView setErrorMessage={setErrorMessage} /> : null}
        {tab === "settings" ? (
          <SettingsView
            snapshot={snapshot}
            selectedNode={selectedNode}
            runVariant={runVariant}
            setRunVariant={setRunVariant}
            pipelineInput={pipelineInput}
            setPipelineInput={setPipelineInput}
            planningError={planningError}
            refresh={refresh}
            setErrorMessage={setErrorMessage}
          />
        ) : null}
      </div>
    </div>
  );
}
