import React from "react";
import { AlertTriangle, Check, Download, FolderOpen, RefreshCw, X } from "lucide-react";
import type { SavedSessionRecord, SavedSessionSummary } from "../../shared/types";
import { post, runAction } from "../../shared/api";
export function SavedSessionPanel({
  sessions,
  detail,
  setDetail,
  refresh,
  setErrorMessage,
}: {
  sessions: SavedSessionSummary[];
  detail: SavedSessionRecord | undefined;
  setDetail: (detail: SavedSessionRecord | undefined) => void;
  refresh: () => Promise<void>;
  setErrorMessage: (message: string | undefined) => void;
}) {
  return (
    <section className="session-panel">
      <div className="panel-heading">
        <div>
          <label>Saved sessions</label>
          <div className="meta-row">
            Save or reopen graph, approvals, artifacts, and memory contract.
          </div>
        </div>
        <div className="actions">
          <button
            onClick={() =>
              runAction(
                setErrorMessage,
                () =>
                  post("/api/saved-sessions/save", {
                    name: `Session ${new Date().toLocaleString()}`,
                  }),
                refresh,
              )
            }
          >
            <Download size={16} aria-hidden />
            Save session
          </button>
          <button onClick={() => runAction(setErrorMessage, async () => refresh(), refresh)}>
            <RefreshCw size={16} aria-hidden />
            Refresh
          </button>
        </div>
      </div>
      {sessions.length === 0 ? (
        <div className="empty session-empty">
          <b>No saved sessions</b>
          <span>
            Save this workflow to reopen the graph, approvals, artifacts, and memory contract later.
          </span>
        </div>
      ) : (
        <div className="session-list">
          {sessions.slice(0, 5).map((item) => (
            <div className={`session-row ${item.status}`} key={item.id}>
              <div className="session-row-main">
                <b>{item.name}</b>
                <span>
                  {item.id} · {new Date(item.updatedAt).toLocaleString()}
                </span>
              </div>
              <span className={`restore-pill ${item.status}`}>{item.status}</span>
              <button
                className="icon"
                title="Inspect saved session"
                aria-label={`Inspect ${item.name}`}
                onClick={() =>
                  runAction(setErrorMessage, async () => {
                    const response = await fetch(
                      `/api/saved-sessions/${encodeURIComponent(item.id)}`,
                    );
                    if (!response.ok) {
                      throw new Error(await response.text());
                    }
                    setDetail((await response.json()) as SavedSessionRecord);
                  })
                }
              >
                {item.status === "complete" ? (
                  <Check size={16} aria-hidden />
                ) : (
                  <AlertTriangle size={16} aria-hidden />
                )}
              </button>
              <button
                className="icon"
                title="Open saved session"
                aria-label={`Open ${item.name}`}
                onClick={() =>
                  runAction(
                    setErrorMessage,
                    () => post(`/api/saved-sessions/${encodeURIComponent(item.id)}/open`, {}),
                    refresh,
                  )
                }
              >
                <FolderOpen size={16} aria-hidden />
              </button>
            </div>
          ))}
        </div>
      )}
      {detail ? (
        <div className={`restore-detail ${detail.verification.status}`}>
          <div className="panel-heading">
            <div>
              <b>
                {detail.verification.status === "complete"
                  ? "Session restored"
                  : "Session restored with missing data"}
              </b>
              <div className="meta-row">
                {detail.name} · unsafeToContinue={String(detail.verification.unsafeToContinue)}
              </div>
            </div>
            <button
              className="icon"
              aria-label="Close saved session detail"
              onClick={() => setDetail(undefined)}
            >
              <X size={16} aria-hidden />
            </button>
          </div>
          <div className="restore-grid">
            {detail.verification.sections.map((section) => (
              <React.Fragment key={section.name}>
                <span>{section.name}</span>
                <b className={section.status}>{section.status}</b>
                <em>{section.reason ?? `v${section.version ?? "?"}`}</em>
              </React.Fragment>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
