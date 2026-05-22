import { useState } from "react";
import type {
  ExecutionNode,
  GraphWorkflowSummary,
  MemorySnapshot,
  ModelLibraryEntry,
  ModelLibrarySnapshot,
  PluginSnapshot,
  SavedSessionRecord,
  SavedSessionSummary,
  SessionSnapshot,
} from "../shared/types";
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
  modelLibrary: ModelLibrarySnapshot | undefined;
  modelSearch: string;
  setModelSearch: (value: string) => void;
  modelSearchResults: ModelLibraryEntry[];
  setModelSearchResults: (results: ModelLibraryEntry[]) => void;
  refreshModelLibrary: () => Promise<void>;
  pluginSnapshot: PluginSnapshot;
  pluginRestartRequired: boolean;
  setPluginRestartRequired: (value: boolean) => void;
  refreshPlugins: () => Promise<void>;
  savedSessions: SavedSessionSummary[];
  savedSessionDetail: SavedSessionRecord | undefined;
  setSavedSessionDetail: (record: SavedSessionRecord | undefined) => void;
  refreshSavedSessions: () => Promise<void>;
  memory: MemorySnapshot | undefined;
  refreshMemory: () => Promise<void>;
  graphWorkflows: GraphWorkflowSummary[];
  refreshGraphWorkflows: () => Promise<void>;
  runVariant: "playbook" | "pipeline";
  setRunVariant: (variant: "playbook" | "pipeline") => void;
  pipelineInput: string;
  setPipelineInput: (value: string) => void;
  chatMessage: string;
  setChatMessage: (value: string) => void;
  deleteStrategy: "delete_subtree" | "rewire_dependents";
  setDeleteStrategy: (strategy: "delete_subtree" | "rewire_dependents") => void;
  graphHasPlannedNodes: boolean;
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
  modelLibrary,
  modelSearch,
  setModelSearch,
  modelSearchResults,
  setModelSearchResults,
  refreshModelLibrary,
  pluginSnapshot,
  pluginRestartRequired,
  setPluginRestartRequired,
  refreshPlugins,
  savedSessions,
  savedSessionDetail,
  setSavedSessionDetail,
  refreshSavedSessions,
  memory,
  refreshMemory,
  graphWorkflows,
  refreshGraphWorkflows,
  runVariant,
  setRunVariant,
  pipelineInput,
  setPipelineInput,
  chatMessage,
  setChatMessage,
  deleteStrategy,
  setDeleteStrategy,
  graphHasPlannedNodes,
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
              ["plugins", "Plugins"],
              ["sessions", "Sessions"],
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
        {tab === "models" ? (
          <ModelsView
            library={modelLibrary}
            search={modelSearch}
            setSearch={setModelSearch}
            searchResults={modelSearchResults}
            setSearchResults={setModelSearchResults}
            refresh={refreshModelLibrary}
            setErrorMessage={setErrorMessage}
            onMount={() => void refreshModelLibrary()}
          />
        ) : null}
        {tab === "plugins" ? (
          <PluginsView
            snapshot={pluginSnapshot}
            restartRequired={pluginRestartRequired}
            setRestartRequired={setPluginRestartRequired}
            refresh={refreshPlugins}
            setErrorMessage={setErrorMessage}
            onMount={() => void refreshPlugins()}
          />
        ) : null}
        {tab === "sessions" ? (
          <SessionsView
            sessions={savedSessions}
            detail={savedSessionDetail}
            setDetail={setSavedSessionDetail}
            refresh={async () => {
              await refresh();
              await refreshSavedSessions();
            }}
            setErrorMessage={setErrorMessage}
            onMount={() => void refreshSavedSessions()}
          />
        ) : null}
        {tab === "memory" ? (
          <MemoryView
            memory={memory}
            refresh={refreshMemory}
            setErrorMessage={setErrorMessage}
            onMount={() => void refreshMemory()}
          />
        ) : null}
        {tab === "settings" ? (
          <SettingsView
            snapshot={snapshot}
            selectedNode={selectedNode}
            graphWorkflows={graphWorkflows}
            runVariant={runVariant}
            setRunVariant={setRunVariant}
            pipelineInput={pipelineInput}
            setPipelineInput={setPipelineInput}
            chatMessage={chatMessage}
            setChatMessage={setChatMessage}
            deleteStrategy={deleteStrategy}
            setDeleteStrategy={setDeleteStrategy}
            graphHasPlannedNodes={graphHasPlannedNodes}
            planningError={planningError}
            refresh={refresh}
            refreshGraphWorkflows={refreshGraphWorkflows}
            setErrorMessage={setErrorMessage}
            onMount={() => {
              void refreshGraphWorkflows();
            }}
          />
        ) : null}
      </div>
    </div>
  );
}
