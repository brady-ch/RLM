import React, { useEffect, useState } from "react";
import { Check, GitBranchPlus, Scissors, Trash2, X } from "lucide-react";
import type { ExecutionNode } from "../../shared/types";
import { approvalModeLabel, post, runAction } from "../../shared/api";
import {
  parseJsonObject,
  parseOptionalNumber,
  PolicyRows,
  PortRows,
  SamplingRows,
  toInputValue,
} from "./inspectorHelpers";
export function NodeInspector({
  node,
  refresh,
  setErrorMessage,
  planningError,
}: {
  node: ExecutionNode;
  refresh: () => Promise<void>;
  setErrorMessage: (message: string | undefined) => void;
  planningError?: { nodeId: string; message: string } | undefined;
}) {
  const [prompt, setPrompt] = useState(node.prompt ?? node.label);
  const [modelOverride, setModelOverride] = useState(node.modelOverride ?? "");
  const [expertAgentId, setExpertAgentId] = useState<NonNullable<ExecutionNode["expertAgentId"]>>(
    node.expertAgentId ?? "default",
  );
  const [expertRuntime, setExpertRuntime] = useState<NonNullable<ExecutionNode["expertRuntime"]>>(
    node.expertRuntime ?? "single-pass",
  );
  const [expertTools, setExpertTools] = useState((node.expertToolAllowlist ?? []).join(", "));
  const [expertPurposeTiers, setExpertPurposeTiers] = useState(
    JSON.stringify(node.expertPurposeTiers ?? {}, null, 0),
  );
  const [temperature, setTemperature] = useState(toInputValue(node.samplingOverride?.temperature));
  const [topP, setTopP] = useState(toInputValue(node.samplingOverride?.topP));
  const [maxTokens, setMaxTokens] = useState(toInputValue(node.samplingOverride?.maxTokens));
  const [newChildPrompt, setNewChildPrompt] = useState("");
  const [connectParentId, setConnectParentId] = useState("");

  useEffect(() => {
    setPrompt(node.prompt ?? node.label);
    setModelOverride(node.modelOverride ?? "");
    setExpertAgentId(node.expertAgentId ?? "default");
    setExpertRuntime(node.expertRuntime ?? "single-pass");
    setExpertTools((node.expertToolAllowlist ?? []).join(", "));
    setExpertPurposeTiers(JSON.stringify(node.expertPurposeTiers ?? {}, null, 0));
    setTemperature(toInputValue(node.samplingOverride?.temperature));
    setTopP(toInputValue(node.samplingOverride?.topP));
    setMaxTokens(toInputValue(node.samplingOverride?.maxTokens));
  }, [
    node.expertAgentId,
    node.expertPurposeTiers,
    node.expertRuntime,
    node.expertToolAllowlist,
    node.id,
    node.label,
    node.prompt,
    node.samplingOverride?.maxTokens,
    node.samplingOverride?.temperature,
    node.samplingOverride?.topP,
  ]);

  const editable =
    node.status === "planned" || node.status === "ready" || node.status === "awaiting_approval";
  const waiting = node.status === "awaiting_approval";
  const composer = node.composer;

  return (
    <div className="node-inspector">
      <div>
        <label>Node</label>
        <h1>{node.id}</h1>
        {planningError?.nodeId === node.id ? (
          <p className="error" role="alert">
            {planningError.message}
          </p>
        ) : null}
      </div>
      {composer ? (
        <div className="composer-panel">
          <div className="composer-grid">
            <div>
              <label>Node type</label>
              <div className="meta-row strong">{composer.type}</div>
            </div>
            <div>
              <label>Runtime</label>
              <div className="meta-row strong">{composer.runtime}</div>
            </div>
            <div>
              <label>Complexity</label>
              <div className={`meta-row complexity ${composer.complexity}`}>
                {composer.complexity}
              </div>
            </div>
            <div>
              <label>Recommended</label>
              <div className="meta-row strong">{composer.recommendedAction}</div>
            </div>
          </div>
          <div>
            <label>Plan budget</label>
            <div className="budget-box">
              <span>
                Used {composer.planBudget.usedDepth}/{composer.planBudget.maxDepth} depth (cap)
              </span>
              <span>
                Used {composer.planBudget.usedNodes}/{composer.planBudget.maxNodes} nodes (cap)
              </span>
              <span>
                Remaining {composer.planBudget.remainingDepth} depth ·{" "}
                {composer.planBudget.remainingNodes} nodes
              </span>
              <span>{composer.planBudget.approvalRequired ? "approval required" : "auto"}</span>
              {composer.planBudget.exhausted ? (
                <span className="budget-stop">needs approval to expand</span>
              ) : null}
            </div>
          </div>
          <div>
            <label>Ports</label>
            <PortRows title="Inputs" ports={composer.inputs} />
            <PortRows title="Outputs" ports={composer.outputs} />
          </div>
          <div>
            <label>Context Policy</label>
            <PolicyRows title="Reads" items={composer.contextPolicy.reads} />
            <PolicyRows title="Writes" items={composer.contextPolicy.writes} />
            <PolicyRows title="Limits" items={composer.contextPolicy.limits} />
            <PolicyRows title="Memory" items={composer.contextPolicy.memoryScopes} />
          </div>
          <div>
            <label>Artifact refs</label>
            {composer.artifactRefs.length === 0 ? (
              <div className="meta-row">
                No artifact refs yet. Large payloads stay outside graph state.
              </div>
            ) : (
              composer.artifactRefs.map((artifact) => (
                <div className="artifact-row" key={artifact.id}>
                  <b>{artifact.id}</b>
                  <span>{artifact.mediaType}</span>
                  <span>{artifact.uri}</span>
                  {artifact.orderingKey ? <span>order={artifact.orderingKey}</span> : null}
                  {artifact.validation ? (
                    <span
                      className={`artifact-validation artifact-validation-${artifact.validation.state}`}
                    >
                      {artifact.validation.state}
                      {artifact.validation.policy ? ` (${artifact.validation.policy})` : ""}
                      {artifact.validation.reason ? `: ${artifact.validation.reason}` : ""}
                    </span>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </div>
      ) : null}
      <div>
        <label>Prompt</label>
        <textarea
          value={prompt}
          disabled={!editable}
          onChange={(event) => setPrompt(event.target.value)}
        />
      </div>
      <div>
        <label>Model Trail</label>
        <div className="meta-row">Planned: {node.plannedModel ?? "resolved-at-runtime"}</div>
        <div className="meta-row">Effective: {node.effectiveModel ?? "pending"}</div>
        <div className="meta-row">Override Source: {node.modelOverrideSource ?? "none"}</div>
      </div>
      <div>
        <label>Expert Binding</label>
        <div className="meta-row">Preset: {node.expertAgentId ?? "default"}</div>
        <div className="meta-row">Assignment: {node.expertAssignmentMode ?? "planner"}</div>
        <div className="meta-row">Runtime: {node.expertRuntime ?? "single-pass"}</div>
        <div className="meta-row">
          Tools: {(node.expertToolAllowlist ?? []).join(", ") || "agent default"}
        </div>
        <div className="meta-row">
          Purpose tiers: {JSON.stringify(node.expertPurposeTiers ?? {})}
        </div>
      </div>
      <div>
        <label>Sampling</label>
        <SamplingRows sampling={node.effectiveSampling} override={node.samplingOverride} />
      </div>
      <div>
        <label>Approval</label>
        <div className="meta-row">Mode: {approvalModeLabel(node.approvalMode ?? "full")}</div>
        <div className="meta-row">Source: {node.approvalSource ?? "none"}</div>
        <div className="meta-row">
          Spawned after initial approval: {String(node.spawnedAfterInitialApproval ?? false)}
        </div>
      </div>
      <div>
        <label>Model Override</label>
        <input
          value={modelOverride}
          disabled={!editable}
          onChange={(event) => setModelOverride(event.target.value)}
          placeholder="model-name"
        />
        <div className="actions">
          <button
            disabled={!editable || modelOverride.trim().length === 0}
            onClick={() =>
              runAction(
                setErrorMessage,
                () => post(`/api/nodes/${node.id}/model`, { model: modelOverride }),
                refresh,
              )
            }
          >
            Set model
          </button>
        </div>
      </div>
      <div>
        <label>Expert Override</label>
        <select
          value={expertAgentId}
          disabled={!editable}
          onChange={(event) =>
            setExpertAgentId(event.target.value as NonNullable<ExecutionNode["expertAgentId"]>)
          }
        >
          {["default", "coding", "qa", "product_designer", "research"].map((agent) => (
            <option key={agent} value={agent}>
              {agent}
            </option>
          ))}
        </select>
        <select
          value={expertRuntime}
          disabled={!editable}
          onChange={(event) =>
            setExpertRuntime(event.target.value as NonNullable<ExecutionNode["expertRuntime"]>)
          }
        >
          <option value="single-pass">single-pass</option>
          <option value="rlm">rlm</option>
        </select>
        <input
          value={expertTools}
          disabled={!editable}
          onChange={(event) => setExpertTools(event.target.value)}
          placeholder="shell, write_file"
        />
        <input
          value={expertPurposeTiers}
          disabled={!editable}
          onChange={(event) => setExpertPurposeTiers(event.target.value)}
          placeholder='{"answer":"small"}'
        />
        <div className="actions">
          <button
            disabled={!editable}
            onClick={() =>
              runAction(
                setErrorMessage,
                () =>
                  post(`/api/nodes/${node.id}/expert`, {
                    agentId: expertAgentId,
                    runtime: expertRuntime,
                    toolAllowlist: expertTools
                      .split(",")
                      .map((tool) => tool.trim())
                      .filter(Boolean),
                    purposeTiers: parseJsonObject(expertPurposeTiers),
                  }),
                refresh,
              )
            }
          >
            Set expert
          </button>
        </div>
      </div>
      <div>
        <label>Sampling Override</label>
        <div className="sampling-grid">
          <input
            value={temperature}
            disabled={!editable}
            onChange={(event) => setTemperature(event.target.value)}
            placeholder="temperature"
            inputMode="decimal"
          />
          <input
            value={topP}
            disabled={!editable}
            onChange={(event) => setTopP(event.target.value)}
            placeholder="top-p"
            inputMode="decimal"
          />
          <input
            value={maxTokens}
            disabled={!editable}
            onChange={(event) => setMaxTokens(event.target.value)}
            placeholder="max tokens"
            inputMode="numeric"
          />
        </div>
        <div className="actions">
          <button
            disabled={!editable}
            onClick={() =>
              runAction(
                setErrorMessage,
                () =>
                  post(`/api/nodes/${node.id}/sampling`, {
                    temperature: parseOptionalNumber(temperature),
                    topP: parseOptionalNumber(topP),
                    maxTokens: parseOptionalNumber(maxTokens),
                  }),
                refresh,
              )
            }
          >
            Set sampling
          </button>
        </div>
      </div>
      <div className="actions">
        <button
          disabled={!editable}
          onClick={() =>
            runAction(
              setErrorMessage,
              () => post(`/api/nodes/${node.id}/edit`, { prompt }),
              refresh,
            )
          }
        >
          Save prompt
        </button>
        <button
          disabled={!editable}
          onClick={() =>
            runAction(setErrorMessage, () => post(`/api/nodes/${node.id}/plan`, {}), refresh)
          }
        >
          <GitBranchPlus size={16} /> Plan children
        </button>
        <button
          disabled={!editable}
          onClick={() =>
            runAction(setErrorMessage, () => post(`/api/nodes/${node.id}/breakdown`, {}), refresh)
          }
        >
          <Scissors size={16} /> Break down
        </button>
        <button
          disabled={!editable || composer?.planBudget.exhausted !== true}
          onClick={() =>
            runAction(
              setErrorMessage,
              () => post(`/api/nodes/${node.id}/extend-budget`, {}),
              refresh,
            )
          }
        >
          Extend budget
        </button>
        <button
          disabled={!waiting}
          onClick={() =>
            runAction(
              setErrorMessage,
              () => post(`/api/nodes/${node.id}/approve`, { token: node.approvalToken }),
              refresh,
            )
          }
        >
          <Check size={16} /> Approve
        </button>
        <button
          disabled={!waiting}
          onClick={() =>
            runAction(
              setErrorMessage,
              () => post(`/api/nodes/${node.id}/skip`, { token: node.approvalToken }),
              refresh,
            )
          }
        >
          <X size={16} /> Skip
        </button>
      </div>
      <div>
        <label>Add Child</label>
        <textarea
          value={newChildPrompt}
          disabled={!editable}
          onChange={(event) => setNewChildPrompt(event.target.value)}
          placeholder="New child prompt"
        />
        <div className="actions">
          <button
            disabled={!editable || newChildPrompt.trim().length === 0}
            onClick={() =>
              runAction(
                setErrorMessage,
                () => post("/api/nodes/add", { parentId: node.id, prompt: newChildPrompt }),
                refresh,
              )
            }
          >
            Add child
          </button>
        </div>
      </div>
      <div>
        <label>Connect Parent ID</label>
        <input
          value={connectParentId}
          disabled={!editable}
          onChange={(event) => setConnectParentId(event.target.value)}
          placeholder="task-1"
        />
        <div className="actions">
          <button
            disabled={!editable || connectParentId.trim().length === 0}
            onClick={() =>
              runAction(
                setErrorMessage,
                () => post(`/api/nodes/${node.id}/connect`, { parentId: connectParentId }),
                refresh,
              )
            }
          >
            Connect
          </button>
          <button
            disabled={!editable}
            className="danger"
            onClick={() =>
              runAction(setErrorMessage, () => post(`/api/nodes/${node.id}/delete`, {}), refresh)
            }
          >
            <Trash2 size={16} /> Delete subtree
          </button>
        </div>
      </div>
    </div>
  );
}
