import type { QualityLoopMetadata } from "../shared/types";
import { scoreFromSelection } from "../shared/api";
export function QualityLoopCardSummary({ loop }: { loop: QualityLoopMetadata }) {
  const score = loop.gate?.score ?? scoreFromSelection(loop.selection?.scoreBasis);
  const selected = loop.selectedCandidateId ?? "none";
  const issueCount = loop.unresolvedIssues.length;
  return (
    <div className={`loop-card-summary ${loop.status}`}>
      <div className="loop-summary-grid">
        <span>Status</span>
        <b>{loop.status}</b>
        <span>Score</span>
        <b>{score ?? "none"}</b>
        <span>Iterations</span>
        <b>
          {loop.usage.iterationsCompleted}/{loop.usage.iterationsStarted}
        </b>
        <span>Stop</span>
        <b>{loop.stopReason ?? "pending"}</b>
      </div>
      <div className="loop-selected">Selected: {selected}</div>
      {issueCount > 0 ? (
        <div className="loop-alert">
          {issueCount} unresolved issue{issueCount === 1 ? "" : "s"}
        </div>
      ) : null}
    </div>
  );
}
