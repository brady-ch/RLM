import React, { useEffect, useState } from "react";
import { AlertTriangle, Check, Download, Puzzle, RefreshCw, Trash2, X } from "lucide-react";
import type {
  PluginDoctorIssue,
  PluginInstallPreview,
  PluginListItem,
  PluginMutationResult,
  PluginSnapshot,
} from "../../shared/types";
import { postJson, runAction } from "../../shared/api";
export function formatPluginLine(plugin: PluginListItem): string {
  const tools = plugin.tools.join(", ") || "(none)";
  return `${plugin.id} [${plugin.category}] source=${plugin.source} enabled=${plugin.enabled} tools=${tools}`;
}

export function formatDoctorIssue(issue: PluginDoctorIssue): string {
  const prefix = issue.severity === "error" ? "ERROR" : "WARN";
  return `${prefix} ${issue.code}: ${issue.message}`;
}

export function PluginPanel({
  snapshot,
  restartRequired,
  setRestartRequired,
  refresh,
  setErrorMessage,
}: {
  snapshot: PluginSnapshot;
  restartRequired: boolean;
  setRestartRequired: (value: boolean) => void;
  refresh: () => Promise<void>;
  setErrorMessage: (message: string | undefined) => void;
}) {
  const [installSource, setInstallSource] = useState("");
  const [pendingInstall, setPendingInstall] = useState<PluginInstallPreview | undefined>();

  const markRestartIfNeeded = (result: { requiresRestart?: boolean }) => {
    if (result.requiresRestart) {
      setRestartRequired(true);
    }
  };

  const runInstall = async (source: string, confirm = false) => {
    const payload = (await postJson("/api/plugins/install", {
      path: source,
      ...(confirm ? { confirm: true } : {}),
    })) as PluginInstallPreview | PluginMutationResult;

    if ("needsConfirm" in payload && payload.needsConfirm) {
      setPendingInstall(payload);
      return;
    }

    setPendingInstall(undefined);
    setInstallSource("");
    markRestartIfNeeded(payload);
  };

  const runPluginMutation = async (
    path: string,
    body: Record<string, unknown>,
  ): Promise<PluginMutationResult> => {
    const payload = (await postJson(path, body)) as PluginMutationResult;
    markRestartIfNeeded(payload);
    return payload;
  };

  const doctor = snapshot.doctor;
  const doctorIssues = doctor?.issues ?? [];
  const doctorFixes = doctor?.fixesApplied ?? [];

  return (
    <section className="plugin-panel" aria-labelledby="plugin-panel-title">
      <div className="panel-heading">
        <div>
          <label id="plugin-panel-title">Plugins</label>
          <div className="meta-row">Manage installed plugins via the same registry as CLI.</div>
        </div>
        <button
          className="icon"
          title="Refresh plugins"
          aria-label="Refresh plugins"
          onClick={() => runAction(setErrorMessage, refresh, refresh)}
        >
          <RefreshCw size={16} aria-hidden />
        </button>
      </div>

      {restartRequired ? (
        <div className="meta-row warning plugin-restart-banner" role="status">
          <AlertTriangle size={16} aria-hidden />
          Restart RLM to load plugin changes. Tools are not updated until the session restarts.
        </div>
      ) : null}

      <div className="plugin-install">
        <input
          aria-label="Local path or remote URL"
          placeholder="Local path or remote URL"
          value={installSource}
          onChange={(event) => setInstallSource(event.target.value)}
        />
        <button
          disabled={installSource.trim().length === 0}
          onClick={() =>
            runAction(setErrorMessage, () => runInstall(installSource.trim()), refresh)
          }
        >
          <Download size={16} aria-hidden /> Install
        </button>
      </div>

      {pendingInstall ? (
        <div className="plugin-confirm" role="dialog" aria-labelledby="plugin-confirm-title">
          <div className="plugin-confirm-header">
            <Puzzle size={16} aria-hidden />
            <strong id="plugin-confirm-title">Remote plugin ready to install</strong>
          </div>
          <p>
            {pendingInstall.id}@{pendingInstall.manifest.version}
          </p>
          <div className="meta-row">Source: {pendingInstall.source}</div>
          <div className="meta-row">Category: {pendingInstall.manifest.category}</div>
          <div className="actions">
            <button
              onClick={() =>
                runAction(setErrorMessage, () => runInstall(pendingInstall.source, true), refresh)
              }
            >
              <Check size={16} aria-hidden /> Install (--yes)
            </button>
            <button className="secondary" onClick={() => setPendingInstall(undefined)}>
              <X size={16} aria-hidden /> Cancel
            </button>
          </div>
        </div>
      ) : null}

      <div className="plugin-doctor">
        <div className="panel-heading">
          <label>Plugin doctor</label>
          <div className="actions">
            <button onClick={() => runAction(setErrorMessage, refresh, refresh)}>Run doctor</button>
            <button
              disabled={doctor?.ok !== false}
              onClick={() =>
                runAction(
                  setErrorMessage,
                  async () => {
                    await postJson("/api/plugins/doctor/fix", {});
                    setRestartRequired(true);
                  },
                  refresh,
                )
              }
            >
              Doctor --fix
            </button>
          </div>
        </div>
        {doctor && doctor.ok && doctorIssues.length === 0 && doctorFixes.length === 0 ? (
          <div className="meta-row">Plugin doctor: no issues found.</div>
        ) : null}
        {doctorIssues.map((issue, index) => (
          <div
            className={`meta-row ${issue.severity === "error" ? "warning" : ""}`}
            key={`${issue.code}-${issue.pluginId ?? index}`}
          >
            {formatDoctorIssue(issue)}
          </div>
        ))}
        {doctorFixes.map((fixMessage) => (
          <div className="meta-row" key={fixMessage}>
            FIX: {fixMessage}
          </div>
        ))}
      </div>

      {snapshot.plugins.length === 0 ? (
        <div className="empty session-empty">No plugins found.</div>
      ) : (
        <div className="plugin-list">
          {snapshot.plugins.map((plugin) => (
            <PluginRow
              key={plugin.id}
              plugin={plugin}
              refresh={refresh}
              setErrorMessage={setErrorMessage}
              runPluginMutation={runPluginMutation}
            />
          ))}
        </div>
      )}
    </section>
  );
}

export function PluginRow({
  plugin,
  refresh,
  setErrorMessage,
  runPluginMutation,
}: {
  plugin: PluginListItem;
  refresh: () => Promise<void>;
  setErrorMessage: (message: string | undefined) => void;
  runPluginMutation: (path: string, body: Record<string, unknown>) => Promise<PluginMutationResult>;
}) {
  const capabilityTags = [
    ...plugin.tools.map((tool) => `tool:${tool}`),
    ...plugin.skillLoaders.map((loader) => `skill:${loader}`),
    ...plugin.modelHosts.map((host) => `model:${host}`),
  ];
  const isBuiltin = plugin.source === "builtin";

  return (
    <div className={`plugin-row ${plugin.enabled ? "enabled" : "disabled"}`}>
      <div>
        <b>{plugin.name}</b>
        <div className="meta-row">{formatPluginLine(plugin)}</div>
        {capabilityTags.length > 0 ? (
          <div className="tag-row">
            {capabilityTags.map((tag) => (
              <span key={tag}>{tag}</span>
            ))}
          </div>
        ) : null}
      </div>
      {isBuiltin ? null : (
        <div className="actions plugin-actions">
          <button
            disabled={plugin.enabled}
            onClick={() =>
              runAction(
                setErrorMessage,
                () => runPluginMutation("/api/plugins/enable", { id: plugin.id }),
                refresh,
              )
            }
          >
            Enable
          </button>
          <button
            disabled={!plugin.enabled}
            onClick={() =>
              runAction(
                setErrorMessage,
                () => runPluginMutation("/api/plugins/disable", { id: plugin.id }),
                refresh,
              )
            }
          >
            Disable
          </button>
          <button
            className="danger"
            onClick={() =>
              runAction(
                setErrorMessage,
                () => runPluginMutation("/api/plugins/uninstall", { id: plugin.id }),
                refresh,
              )
            }
          >
            <Trash2 size={16} aria-hidden /> Uninstall
          </button>
        </div>
      )}
    </div>
  );
}
