import React, { useEffect, useState } from "react";
import { Check, Square } from "lucide-react";
import type { ExecutionNode, QualityLoopMetadata } from "../../shared/types";
import { phaseLabel, post, runAction, scoreFromSelection } from "../../shared/api";
export function QualityLoopInspector({
  node,
  loop,
  refresh,
  setErrorMessage,
}: {
  node: ExecutionNode;
  loop: QualityLoopMetadata;
  refresh: () => Promise<void>;
  setErrorMessage: (message: string | undefined) => void;
}) {
  const score = loop.gate?.score ?? scoreFromSelection(loop.selection?.scoreBasis);
  const running = node.status === "running" || loop.status === "running";
  return (
    <div className="quality-loop-panel">
      <label>Quality Loop</label>
      <div className="loop-inspector-grid">
        <div className="meta-row strong">Status: {loop.status}</div>
        <div className="meta-row strong">Score: {score ?? "none"}</div>
        <div className="meta-row">
          Iterations: {loop.usage.iterationsCompleted}/{loop.usage.iterationsStarted}
        </div>
        <div className="meta-row">Stop reason: {loop.stopReason ?? "pending"}</div>
        <div className="meta-row">Selected: {loop.selectedCandidateId ?? "none"}</div>
        <div className="meta-row">Issues: {loop.unresolvedIssues.length}</div>
      </div>
      {loop.rubric ? (
        <div className="loop-detail-block">
          <b>{loop.rubric.label}</b>
          <span>
            {loop.rubric.id} · confidence {loop.rubric.confidence}
          </span>
          <p>{loop.rubric.rationale}</p>
        </div>
      ) : null}
      {loop.gate ? (
        <div className="loop-detail-block">
          <b>Gate: {loop.gate.decision}</b>
          <span>
            score {loop.gate.score} / threshold {loop.gate.passThreshold}
          </span>
          <p>{loop.gate.rationale}</p>
        </div>
      ) : null}
      {loop.selection ? (
        <div className="loop-detail-block">
          <b>Selection</b>
          <span>{loop.selection.selectedCandidateId}</span>
          <p>{loop.selection.rationale}</p>
        </div>
      ) : null}
      {loop.phaseModels ? (
        <div>
          <label>Loop Model Trail</label>
          {Object.values(loop.phaseModels).map((assignment) => (
            <div className="phase-row" key={assignment.phase}>
              <b>{phaseLabel(assignment.phase)}</b>
              <span>
                {assignment.plannedSelection} {"->"} {assignment.effectiveModel}
              </span>
              <span>{assignment.source}</span>
            </div>
          ))}
        </div>
      ) : null}
      <div>
        <label>Iterations</label>
        {loop.iterations.length === 0 ? (
          <div className="meta-row">No iterations yet.</div>
        ) : (
          loop.iterations.map((iteration) => (
            <details
              className="loop-iteration"
              key={iteration.index}
              open={iteration.index === loop.iterations.length - 1}
            >
              <summary>
                Iteration {iteration.index + 1}: {iteration.status}
              </summary>
              {iteration.critiqueEvaluation ? (
                <div className="meta-row">
                  Critique resolved: {String(iteration.critiqueEvaluation.resolved)} ·{" "}
                  {iteration.critiqueEvaluation.summary}
                </div>
              ) : null}
              {iteration.gateEvaluation ? (
                <div className="meta-row">
                  Gate: {iteration.gateEvaluation.decision} · score {iteration.gateEvaluation.score}{" "}
                  · critique resolved {String(iteration.gateEvaluation.critiqueResolved)}
                </div>
              ) : null}
              {iteration.phases.map((phase) => (
                <div className="phase-row" key={`${iteration.index}-${phase.phase}`}>
                  <b>{phaseLabel(phase.phase)}</b>
                  <span>{phase.status}</span>
                  <span>
                    {phase.modelSelection ?? phase.plannedModel ?? "resolved"} {"->"}{" "}
                    {phase.model ?? "pending"}
                  </span>
                  {phase.parseStatus ? <span>{phase.parseStatus}</span> : null}
                  {phase.summary ? <p>{phase.summary}</p> : null}
                </div>
              ))}
            </details>
          ))
        )}
      </div>
      {loop.unresolvedIssues.length > 0 ? (
        <div>
          <label>Loop Issues</label>
          {loop.unresolvedIssues.map((issue) => (
            <div className={`loop-issue ${issue.severity}`} key={issue.id}>
              <b>{issue.severity}</b>
              <span>{phaseLabel(issue.sourcePhase)}</span>
              <p>{issue.text}</p>
            </div>
          ))}
        </div>
      ) : null}
      <div className="actions">
        <button
          disabled={!running}
          onClick={() =>
            runAction(
              setErrorMessage,
              () =>
                post(`/api/nodes/${node.id}/quality-loop/accept`, {
                  reason: "accepted from quality-loop inspector",
                }),
              refresh,
            )
          }
        >
          <Check size={16} /> Accept loop
        </button>
        <button
          disabled={!running}
          className="danger"
          onClick={() =>
            runAction(
              setErrorMessage,
              () =>
                post(`/api/nodes/${node.id}/quality-loop/stop`, {
                  reason: "stopped from quality-loop inspector",
                }),
              refresh,
            )
          }
        >
          <Square size={16} /> Stop loop
        </button>
      </div>
    </div>
  );
}
