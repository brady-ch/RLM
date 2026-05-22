use std::sync::Arc;

use rlm_core::domain::types::{
    QualityLoopBudgetBehavior, QualityLoopConfig, QualityLoopRubricId, QualityLoopStopReason,
    RecursiveModelConfig,
};
use rlm_core::domain::RecursiveLanguageModel;
use rlm_core::ports::{InMemoryTrace, QueueModel};

const STRUCTURED_CRITIQUE: &str = r#"{"summary":"critique notes","resolved":false,"issues":[],"suggestedImprovements":["clarify the answer"]}"#;

const CONTINUING_GATE: &str = r#"{"decision":"continue","score":0.6,"passThreshold":0.8,"rubricFit":true,"critiqueResolved":false,"meaningfulImprovement":true,"rationale":"Needs another pass.","failedConditions":["score_below_threshold"],"unresolvedIssues":[]}"#;

const PASSING_GATE: &str = r#"{"decision":"pass","score":0.92,"passThreshold":0.8,"rubricFit":true,"critiqueResolved":true,"meaningfulImprovement":true,"rationale":"Meets the rubric.","failedConditions":[],"unresolvedIssues":[]}"#;

fn best_of_progress(answer: &str) -> String {
    serde_json::json!({
        "answer": answer,
        "rationale": "Best candidate by score and issue resolution.",
        "score": 0.9,
        "comparisonNotes": ["Best available answer."]
    })
    .to_string()
}

fn quality_loop_config(max_iterations: u32) -> RecursiveModelConfig {
    RecursiveModelConfig {
        max_depth: Some(0),
        max_dynamic_depth: 0,
        max_branches: 4,
        max_prompt_characters: 4096,
        max_model_calls: 100,
        max_tool_rounds: 0,
        quality_loop: Some(QualityLoopConfig {
            enabled: true,
            max_iterations,
            budget_behavior: QualityLoopBudgetBehavior::StopBeforePartialIteration,
            phase_models: None,
        }),
    }
}

async fn run_quality_loop(
    prompt: &str,
    responses: Vec<&str>,
    max_iterations: u32,
) -> rlm_core::domain::types::RecursivePromptResult {
    let trace = Arc::new(InMemoryTrace::new());
    let model = Arc::new(QueueModel::new(responses));
    let engine = RecursiveLanguageModel::new(model, trace, vec![]);
    engine
        .run(prompt, quality_loop_config(max_iterations), None)
        .await
        .expect("quality loop run")
}

#[tokio::test]
async fn quality_loop_runs_all_five_phases() {
    let result = run_quality_loop(
        "Improve this answer",
        vec![
            "draft answer",
            STRUCTURED_CRITIQUE,
            "refined answer",
            CONTINUING_GATE,
            &best_of_progress("best final answer"),
        ],
        1,
    )
    .await;

    let loop_meta = result.metadata.quality_loop.expect("quality loop metadata");
    assert_eq!(loop_meta.usage.phase_call_counts.draft, 1);
    assert_eq!(loop_meta.usage.phase_call_counts.critique, 1);
    assert_eq!(loop_meta.usage.phase_call_counts.refine, 1);
    assert_eq!(loop_meta.usage.phase_call_counts.gate, 1);
    assert_eq!(loop_meta.usage.phase_call_counts.best_of_progress, 1);
    assert_eq!(result.answer, "best final answer");
}

#[tokio::test]
async fn quality_loop_selects_code_engineering_rubric() {
    let result = run_quality_loop(
        "Fix the failing TypeScript test in src/domain/types.ts.",
        vec![
            "draft answer",
            STRUCTURED_CRITIQUE,
            "refined answer",
            CONTINUING_GATE,
            &best_of_progress("best final answer"),
        ],
        1,
    )
    .await;

    let rubric = result
        .metadata
        .quality_loop
        .and_then(|m| m.rubric)
        .expect("rubric");
    assert!(matches!(rubric.id, QualityLoopRubricId::CodeEngineering));
}

#[tokio::test]
async fn quality_loop_gate_stops_with_passed() {
    let result = run_quality_loop(
        "Improve this answer",
        vec![
            "draft answer",
            STRUCTURED_CRITIQUE,
            "refined answer",
            PASSING_GATE,
            &best_of_progress("best final answer"),
        ],
        1,
    )
    .await;

    let loop_meta = result.metadata.quality_loop.expect("quality loop metadata");
    assert!(matches!(
        loop_meta.stop_reason,
        Some(QualityLoopStopReason::Passed)
    ));
}

#[tokio::test]
async fn quality_loop_budget_stops_before_partial_iteration() {
    let trace = Arc::new(InMemoryTrace::new());
    let model = Arc::new(QueueModel::new([] as [&str; 0]));
    let engine = RecursiveLanguageModel::new(model, trace, vec![]);
    let config = RecursiveModelConfig {
        max_depth: Some(0),
        max_dynamic_depth: 0,
        max_branches: 4,
        max_prompt_characters: 4096,
        max_model_calls: 4,
        max_tool_rounds: 0,
        quality_loop: Some(QualityLoopConfig {
            enabled: true,
            max_iterations: 1,
            budget_behavior: QualityLoopBudgetBehavior::StopBeforePartialIteration,
            phase_models: None,
        }),
    };
    let result = engine
        .run("Improve this answer", config, None)
        .await
        .expect("run");

    let loop_meta = result.metadata.quality_loop.expect("quality loop metadata");
    assert_eq!(result.answer, "");
    assert!(matches!(
        loop_meta.stop_reason,
        Some(QualityLoopStopReason::BudgetExhausted)
    ));
    assert!(loop_meta.iterations.is_empty());
    assert_eq!(loop_meta.usage.model_calls_total, 0);
}

#[tokio::test]
async fn quality_loop_mirrors_metadata_onto_graph_node() {
    let result = run_quality_loop(
        "Fix bug in src/domain/types.ts",
        vec![
            "draft answer",
            STRUCTURED_CRITIQUE,
            "refined answer",
            CONTINUING_GATE,
            &best_of_progress("best final answer"),
        ],
        1,
    )
    .await;

    let graph = result.metadata.execution_graph.expect("graph");
    let node = graph.nodes.first().expect("node");
    assert_eq!(node.kind, "quality-loop");
    assert!(node.r#loop.is_some());
    assert_eq!(
        node.r#loop
            .as_ref()
            .and_then(|l| l.rubric.as_ref().map(|r| &r.id)),
        result
            .metadata
            .quality_loop
            .as_ref()
            .and_then(|l| l.rubric.as_ref().map(|r| &r.id))
    );
}
