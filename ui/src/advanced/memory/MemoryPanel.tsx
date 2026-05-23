import React, { useState } from "react";
import { RefreshCw, Trash2 } from "lucide-react";
import type { MemorySnapshot } from "../../shared/types";
import { del, formatPreferenceValue, post, runAction } from "../../shared/api";
export function MemoryPanel({
  memory,
  refresh,
  setErrorMessage,
}: {
  memory?: MemorySnapshot;
  refresh: () => Promise<void>;
  setErrorMessage: (message: string | undefined) => void;
}) {
  const [key, setKey] = useState("");
  const [value, setValue] = useState("");
  const preferences = memory?.scopes.find((scope) => scope.scopeId === "project-preferences");
  const preferenceEntries = Object.entries(preferences?.content ?? {});
  const rejected = memory?.audit.filter((record) => !record.accepted) ?? [];
  const degradedPackets =
    memory?.packets.filter((packet) => packet.degraded || packet.truncated) ?? [];

  return (
    <section className="memory-panel">
      <div className="panel-heading">
        <div>
          <label>Memory</label>
          <div className="meta-row">
            {memory
              ? `${memory.scopes.length} scopes · ${memory.episodic.length} episodes · ${memory.packets.length} packets`
              : "Memory inspection unavailable."}
          </div>
        </div>
        <button
          className="icon"
          title="Refresh memory"
          onClick={() => runAction(setErrorMessage, refresh, refresh)}
        >
          <RefreshCw size={16} aria-hidden />
        </button>
      </div>
      <div className="preference-editor">
        <input
          value={key}
          onChange={(event) => setKey(event.target.value)}
          placeholder="Preference key"
        />
        <input
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="Preference value"
        />
        <button
          disabled={!key.trim() || !value.trim()}
          onClick={() =>
            runAction(
              setErrorMessage,
              async () => {
                await post("/api/memory/preferences", { key, value, lifetime: "project" });
                setKey("");
                setValue("");
              },
              refresh,
            )
          }
        >
          Save
        </button>
      </div>
      {preferenceEntries.length === 0 ? (
        <div className="meta-row">No project preferences saved.</div>
      ) : (
        preferenceEntries.map(([prefKey, prefValue]) => (
          <div className="memory-row" key={prefKey}>
            <div>
              <b>{prefKey}</b>
              <span>{formatPreferenceValue(prefValue)}</span>
            </div>
            <button
              className="icon danger"
              aria-label={`Delete preference ${prefKey}`}
              onClick={() =>
                runAction(
                  setErrorMessage,
                  () => del(`/api/memory/preferences/${encodeURIComponent(prefKey)}`),
                  refresh,
                )
              }
            >
              <Trash2 size={16} aria-hidden />
            </button>
          </div>
        ))
      )}
      <div className="memory-grid">
        {(memory?.scopes ?? []).slice(0, 6).map((scope) => (
          <div className="memory-chip" key={`${scope.lifetime}:${scope.scopeId}`}>
            <b>{scope.scopeId}</b>
            <span>
              {scope.lifetime} · v{scope.version}
            </span>
          </div>
        ))}
      </div>
      {(memory?.episodic ?? []).slice(-4).map((entry) => (
        <div className="meta-row" key={entry.id}>
          {entry.type}
          {entry.nodeId ? ` ${entry.nodeId}` : ""}: {entry.summary}
        </div>
      ))}
      {degradedPackets.length > 0 ? (
        <div className="meta-row warning">
          {degradedPackets.length} degraded or truncated packet
          {degradedPackets.length === 1 ? "" : "s"} recorded.
        </div>
      ) : null}
      {(memory?.packets ?? [])
        .flatMap((packet) => packet.retrievalHits ?? [])
        .slice(0, 3)
        .map((hit, index) => (
          <div className="meta-row" key={`${hit.scopeId}-${index}`}>
            {hit.source}:{hit.scopeId} score {hit.score.toFixed(3)} - {hit.snippet}
          </div>
        ))}
      {rejected.length > 0 ? (
        <div className="meta-row warning">
          {rejected.length} rejected memory write{rejected.length === 1 ? "" : "s"} in audit.
        </div>
      ) : null}
    </section>
  );
}
