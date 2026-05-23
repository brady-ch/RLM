import React, { useEffect, useState } from "react";
import { FolderOpen, Sparkles } from "lucide-react";
import type { SavedSessionSummary } from "../shared/types";
import { post, runAction } from "../shared/api";

export type FirstRunLauncherProps = {
  sessions: SavedSessionSummary[];
  refreshSessions: () => Promise<void>;
  refresh: () => Promise<void>;
  setErrorMessage: (message: string | undefined) => void;
  initialPrompt: string;
  onContinue: () => void;
};

export function FirstRunLauncher({
  sessions,
  refreshSessions,
  refresh,
  setErrorMessage,
  initialPrompt,
  onContinue,
}: FirstRunLauncherProps) {
  const [prompt, setPrompt] = useState(initialPrompt);
  const [planning, setPlanning] = useState(false);

  useEffect(() => {
    setPrompt(initialPrompt);
  }, [initialPrompt]);

  useEffect(() => {
    void refreshSessions();
  }, [refreshSessions]);

  const savePrompt = async () => {
    const trimmed = prompt.trim();
    if (!trimmed) {
      throw new Error("Enter a workflow description before continuing.");
    }
    await post("/api/nodes/root-composer/edit", { prompt: trimmed });
  };

  const handleContinue = () => {
    void runAction(
      setErrorMessage,
      async () => {
        await savePrompt();
        onContinue();
      },
      refresh,
    );
  };

  const handlePlanChildren = () => {
    if (planning) {
      return;
    }
    void runAction(
      setErrorMessage,
      async () => {
        setPlanning(true);
        try {
          await savePrompt();
          await post("/api/nodes/root-composer/plan", {});
          onContinue();
        } finally {
          setPlanning(false);
        }
      },
      refresh,
    );
  };

  const handleOpenSession = (sessionId: string) => {
    void runAction(
      setErrorMessage,
      async () => {
        await post(`/api/saved-sessions/${encodeURIComponent(sessionId)}/open`, {});
        onContinue();
      },
      refresh,
    );
  };

  return (
    <div className="first-run-overlay" data-testid="first-run-launcher" role="dialog" aria-modal="true" aria-labelledby="first-run-title">
      <div className="first-run-card">
        <header className="first-run-header">
          <Sparkles size={20} aria-hidden />
          <div>
            <h1 id="first-run-title">Start a workflow</h1>
            <p className="first-run-lead">
              Describe what you want to build, then plan and run on the graph canvas.
            </p>
          </div>
        </header>

        <div className="first-run-grid">
          <section className="first-run-composer" aria-labelledby="composer-heading">
            <h2 id="composer-heading">Guided composer</h2>
            <label htmlFor="first-run-prompt">Workflow description</label>
            <textarea
              id="first-run-prompt"
              className="first-run-prompt"
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder="Example: Build a two-step checklist workflow for testing recursive prompting"
              rows={5}
            />
            <p className="first-run-hint">
              After continuing, right-click the root node → Plan children to generate your graph.
            </p>
            <div className="first-run-actions">
              <button type="button" className="btn-run-primary" onClick={handleContinue}>
                Continue to graph
              </button>
              <button
                type="button"
                className="secondary"
                disabled={planning || !prompt.trim()}
                onClick={handlePlanChildren}
              >
                {planning ? "Planning…" : "Plan children now"}
              </button>
            </div>
          </section>

          <section className="first-run-sessions" aria-labelledby="sessions-heading">
            <h2 id="sessions-heading">Saved sessions</h2>
            <p className="first-run-hint">Reopen a saved graph or start fresh with the composer.</p>
            <button type="button" className="secondary first-run-fresh" onClick={onContinue}>
              Start fresh
            </button>
            {sessions.length === 0 ? (
              <div className="empty session-empty">
                <b>No saved sessions yet</b>
                <span>Save from Advanced → Sessions after you build a workflow.</span>
              </div>
            ) : (
              <ul className="first-run-session-list">
                {sessions.slice(0, 8).map((item) => (
                  <li key={item.id} className={`first-run-session-row ${item.status}`}>
                    <div className="first-run-session-main">
                      <b>{item.name}</b>
                      <span>{new Date(item.updatedAt).toLocaleString()}</span>
                    </div>
                    <button
                      type="button"
                      className="secondary"
                      aria-label={`Open ${item.name}`}
                      onClick={() => handleOpenSession(item.id)}
                    >
                      <FolderOpen size={16} aria-hidden />
                      Open
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
