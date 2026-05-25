import { lazy, Suspense, useState } from "react";
import type { ExecutionNode, SessionSnapshot } from "../shared/types";
import { AdvancedLoadingFallback } from "./AdvancedLoadingFallback";

const ModelsView = lazy(() =>
  import("./ModelsView").then((module) => ({ default: module.ModelsView })),
);
const PluginsView = lazy(() =>
  import("./PluginsView").then((module) => ({ default: module.PluginsView })),
);
const SessionsView = lazy(() =>
  import("./SessionsView").then((module) => ({ default: module.SessionsView })),
);
const MemoryView = lazy(() =>
  import("./MemoryView").then((module) => ({ default: module.MemoryView })),
);
const SettingsView = lazy(() =>
  import("./SettingsView").then((module) => ({ default: module.SettingsView })),
);

export type AdvancedTab = "models" | "plugins" | "sessions" | "memory" | "settings";

export type AdvancedHubProps = {
  onBack: () => void;
  initialTab?: AdvancedTab;
  snapshot: SessionSnapshot;
  selectedNode: ExecutionNode | undefined;
  errorMessage: string | undefined;
  setErrorMessage: (message: string | undefined) => void;
  refresh: () => Promise<void>;
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
        {tab === "models" ? (
          <Suspense fallback={<AdvancedLoadingFallback label="Loading models…" />}>
            <ModelsView setErrorMessage={setErrorMessage} />
          </Suspense>
        ) : null}
        {tab === "plugins" ? (
          <Suspense fallback={<AdvancedLoadingFallback label="Loading plugins…" />}>
            <PluginsView setErrorMessage={setErrorMessage} />
          </Suspense>
        ) : null}
        {tab === "sessions" ? (
          <Suspense fallback={<AdvancedLoadingFallback label="Loading sessions…" />}>
            <SessionsView refreshSession={refresh} setErrorMessage={setErrorMessage} />
          </Suspense>
        ) : null}
        {tab === "memory" ? (
          <Suspense fallback={<AdvancedLoadingFallback label="Loading memory…" />}>
            <MemoryView setErrorMessage={setErrorMessage} />
          </Suspense>
        ) : null}
        {tab === "settings" ? (
          <Suspense fallback={<AdvancedLoadingFallback label="Loading settings…" />}>
            <SettingsView
              snapshot={snapshot}
              selectedNode={selectedNode}
              planningError={planningError}
              refresh={refresh}
              setErrorMessage={setErrorMessage}
            />
          </Suspense>
        ) : null}
      </div>
    </div>
  );
}
