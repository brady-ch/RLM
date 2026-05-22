use rlm_core::domain::types::{ExecutionGraphNode, ExecutionStatus, GraphPosition};
use rlm_core::execution::InteractiveExecutionSession;

#[test]
fn preview_mutation_from_chat_parses_edit_command() {
    let session = InteractiveExecutionSession::new(Default::default());
    session.register_node_for_test(ExecutionGraphNode {
        id: "root-composer".into(),
        label: "Root".into(),
        prompt: Some("old".into()),
        status: ExecutionStatus::Ready,
        position: Some(GraphPosition { x: 0.0, y: 0.0 }),
        ..Default::default()
    });
    let proposal = session
        .preview_mutation_from_chat("edit root-composer: new prompt")
        .expect("proposal");
    assert!(proposal["summary"]
        .as_str()
        .is_some_and(|summary| summary.contains("root-composer")));
    let applied = session
        .apply_pending_mutation(proposal["id"].as_str(), None)
        .expect("apply");
    assert_eq!(applied["applied"], true);
}

#[test]
fn abort_run_from_clarification_rejects_unknown_question_id() {
    let session = InteractiveExecutionSession::new(Default::default());
    let err = session
        .abort_run_from_clarification("missing")
        .expect_err("unknown question");
    assert!(err.contains("Unknown or resolved clarification question."));
}
