import React, { useEffect, useState } from "react";
import { Download, RefreshCw, Upload, X } from "lucide-react";
import type { GraphWorkflowSaveVariant, GraphWorkflowSummary } from "../../shared/types";
import { post, runAction } from "../../shared/api";
export function GraphWorkflowPanel({
  workflows,
  graphNodeCount,
  runVariant,
  setRunVariant,
  pipelineInput,
  setPipelineInput,
  refresh,
  setErrorMessage,
}: {
  workflows: GraphWorkflowSummary[];
  graphNodeCount: number;
  runVariant: "playbook" | "pipeline";
  setRunVariant: (variant: "playbook" | "pipeline") => void;
  pipelineInput: string;
  setPipelineInput: (value: string) => void;
  refresh: () => Promise<void>;
  setErrorMessage: (message: string | undefined) => void;
}) {
  const [saveOpen, setSaveOpen] = useState(false);
  const [workflowName, setWorkflowName] = useState("");
  const [description, setDescription] = useState("");
  const [saveVariant, setSaveVariant] = useState<GraphWorkflowSaveVariant>("both");
  const [saveMessage, setSaveMessage] = useState<string | undefined>();

  return (
    <section className="session-panel graph-workflow-panel">
      <div className="panel-heading">
        <div>
          <label>Graph workflows</label>
          <div className="meta-row">Save, import, and run frozen graph sidecars.</div>
        </div>
        <div className="actions">
          <button disabled={graphNodeCount === 0} onClick={() => setSaveOpen(true)}>
            <Download size={16} aria-hidden />
            Save as workflow
          </button>
          <button onClick={() => runAction(setErrorMessage, async () => refresh(), refresh)}>
            <RefreshCw size={16} aria-hidden />
            Refresh
          </button>
        </div>
      </div>
      <div className="run-variant-controls">
        <label htmlFor="run-variant">Run as</label>
        <select
          id="run-variant"
          value={runVariant}
          onChange={(event) => setRunVariant(event.target.value as "playbook" | "pipeline")}
        >
          <option value="playbook">Playbook</option>
          <option value="pipeline">Pipeline</option>
        </select>
        {runVariant === "pipeline" ? (
          <input
            aria-label="Pipeline task input"
            placeholder="Task input for {{input}}"
            value={pipelineInput}
            onChange={(event) => setPipelineInput(event.target.value)}
          />
        ) : null}
      </div>
      {saveMessage ? <div className="meta-row">{saveMessage}</div> : null}
      {workflows.length === 0 ? (
        <div className="empty session-empty">
          <b>No graph workflows</b>
          <span>Save the current graph as a workflow sidecar under .rlm/workflows/.</span>
        </div>
      ) : (
        <div className="session-list">
          <div className="meta-row">Graph workflows</div>
          {workflows.map((item) => (
            <div className="session-row complete" key={item.id}>
              <div className="session-row-main">
                <b>{item.id}</b>
                <span>
                  {item.variants.join(", ")} · {new Date(item.updatedAt).toLocaleString()}
                </span>
              </div>
              <button
                className="icon"
                title="Import workflow"
                aria-label={`Import ${item.id}`}
                onClick={() => {
                  if (
                    !window.confirm(`Import workflow "${item.id}"? Current graph will be replaced.`)
                  ) {
                    return;
                  }
                  void runAction(
                    setErrorMessage,
                    async () => {
                      await post("/api/graph-workflows/import", { workflowId: item.id });
                      setSaveMessage(
                        `Workflow imported: ${item.id} — Edit and re-export from the graph editor.`,
                      );
                    },
                    refresh,
                  );
                }}
              >
                <Upload size={16} aria-hidden />
                Import workflow
              </button>
            </div>
          ))}
        </div>
      )}
      {saveOpen ? (
        <div className="modal-overlay" role="presentation" onClick={() => setSaveOpen(false)}>
          <div
            className="modal-card"
            role="dialog"
            aria-labelledby="save-graph-workflow-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="panel-heading">
              <h2 id="save-graph-workflow-title">Save graph workflow</h2>
              <button
                className="icon"
                aria-label="Close save dialog"
                onClick={() => setSaveOpen(false)}
              >
                <X size={16} aria-hidden />
              </button>
            </div>
            <label htmlFor="workflow-name">Workflow name</label>
            <input
              id="workflow-name"
              value={workflowName}
              onChange={(event) => setWorkflowName(event.target.value)}
            />
            <label htmlFor="workflow-description">Description (optional)</label>
            <textarea
              id="workflow-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
            <fieldset className="variant-fieldset">
              <legend>Save as:</legend>
              <label>
                <input
                  type="radio"
                  name="save-variant"
                  checked={saveVariant === "playbook"}
                  onChange={() => setSaveVariant("playbook")}
                />{" "}
                Playbook
              </label>
              <div className="meta-row">Replay with literal prompts — no substitution.</div>
              <label>
                <input
                  type="radio"
                  name="save-variant"
                  checked={saveVariant === "pipeline"}
                  onChange={() => setSaveVariant("pipeline")}
                />{" "}
                Pipeline
              </label>
              <div className="meta-row">
                Root prompt uses `{"{{input}}"}` for new tasks each run.
              </div>
              <label>
                <input
                  type="radio"
                  name="save-variant"
                  checked={saveVariant === "both"}
                  onChange={() => setSaveVariant("both")}
                />{" "}
                Both
              </label>
            </fieldset>
            <div className="actions">
              <button
                disabled={workflowName.trim().length === 0}
                onClick={() =>
                  runAction(
                    setErrorMessage,
                    async () => {
                      await post("/api/graph-workflows/export", {
                        workflowId: workflowName.trim(),
                        description: description.trim() || undefined,
                        variant: saveVariant,
                      });
                      setSaveMessage(`Workflow saved: ${workflowName.trim()}`);
                      setSaveOpen(false);
                    },
                    refresh,
                  )
                }
              >
                Save
              </button>
              <button onClick={() => setSaveOpen(false)}>Cancel</button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
