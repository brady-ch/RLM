export const config = {
  maxDepth: 2,
  maxDynamicDepth: 4,
  maxBranches: 2,
  maxPromptCharacters: 1_000,
  maxModelCalls: 100,
  maxToolRounds: 3,
};

export const dynamicDepthConfig = {
  maxDynamicDepth: 4,
  maxBranches: 2,
  maxPromptCharacters: 1_000,
  maxModelCalls: 100,
  maxToolRounds: 3,
};

export const structuredCritique = JSON.stringify({
  summary: "critique notes",
  resolved: false,
  issues: [],
  suggestedImprovements: ["clarify the answer"],
});

export const continuingGate = JSON.stringify({
  decision: "continue",
  score: 0.6,
  passThreshold: 0.8,
  rubricFit: true,
  critiqueResolved: false,
  meaningfulImprovement: true,
  rationale: "Needs another pass.",
  failedConditions: ["score_below_threshold"],
  unresolvedIssues: [],
});

export const passingGate = JSON.stringify({
  decision: "pass",
  score: 0.92,
  passThreshold: 0.8,
  rubricFit: true,
  critiqueResolved: true,
  meaningfulImprovement: true,
  rationale: "Meets the rubric.",
  failedConditions: [],
  unresolvedIssues: [],
});

export function bestOfProgress(answer: string, selectedCandidateId?: string): string {
  return JSON.stringify({
    ...(selectedCandidateId ? { selectedCandidateId } : {}),
    answer,
    rationale: "Best candidate by score and issue resolution.",
    score: 0.9,
    comparisonNotes: ["Best available answer."],
  });
}
