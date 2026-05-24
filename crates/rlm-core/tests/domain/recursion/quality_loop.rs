use super::*;
use crate::domain::types::{
    QualityLoopGateEvaluation, QualityLoopPhaseName, QualityLoopRubricId, TaskNode,
};

#[test]
fn selects_code_engineering_rubric() {
    let task = TaskNode {
        id: "t1".into(),
        parent_id: None,
        prompt: "Fix the failing TypeScript test in src/domain/types.ts.".into(),
        depth: 0,
        kind: None,
        model_override: None,
        context_policy: None,
    };
    let rubric = select_quality_loop_rubric(&task.prompt, &task);
    assert!(matches!(rubric.id, QualityLoopRubricId::CodeEngineering));
}

#[test]
fn gate_passes_requires_all_conditions() {
    let gate = QualityLoopGateEvaluation {
        decision: "pass".into(),
        score: 0.92,
        pass_threshold: 0.8,
        rubric_fit: true,
        critique_resolved: true,
        meaningful_improvement: true,
        rationale: "ok".into(),
        failed_conditions: vec![],
        unresolved_issues: vec![],
    };
    assert!(gate_passes(&gate));
}

#[test]
fn parses_structured_evaluators() {
    let critique = parse_quality_loop_critique(
        &serde_json::json!({
            "summary": "notes",
            "resolved": false,
            "issues": [],
            "suggestedImprovements": ["clarify"]
        })
        .to_string(),
        QualityLoopPhaseName::Critique,
    )
    .expect("critique");
    assert_eq!(critique.summary, "notes");

    let gate = parse_quality_loop_gate(
        &serde_json::json!({
            "decision": "pass",
            "score": 0.9,
            "passThreshold": 0.8,
            "rubricFit": true,
            "critiqueResolved": true,
            "meaningfulImprovement": true,
            "rationale": "ok",
            "failedConditions": [],
            "unresolvedIssues": []
        })
        .to_string(),
    )
    .expect("gate");
    assert_eq!(gate.decision, "pass");
}
