use std::sync::Arc;

use rlm_core::domain::recursive_language_model::ExecutionControl;
use rlm_core::domain::types::{ApprovalMode, ExecutionStatus, RecursiveModelConfig, TaskNode};
use rlm_core::domain::RecursiveLanguageModel;
use rlm_core::execution::{InteractiveExecutionSession, SessionExecutionControl};
use rlm_core::ports::{InMemoryTrace, QueueModel};

#[tokio::test]
async fn answers_directly_when_max_depth_is_zero() {
    let trace = Arc::new(InMemoryTrace::new());
    let model = Arc::new(QueueModel::new(["direct answer"]));
    let engine = RecursiveLanguageModel::new(model, trace.clone(), vec![]);

    let config = RecursiveModelConfig {
        max_depth: Some(0),
        max_dynamic_depth: 0,
        max_branches: 4,
        max_prompt_characters: 4096,
        max_model_calls: 50,
        max_tool_rounds: 0,
        quality_loop: None,
    };

    let result = engine
        .run("Explain recursion", config, None)
        .await
        .expect("run");

    assert_eq!(result.answer, "direct answer");
    let kinds: Vec<_> = result.trace.iter().map(|e| e.kind.as_str()).collect();
    assert!(kinds.contains(&"answer"));
}

#[tokio::test]
async fn engine_integrates_with_session_control() {
    let trace = Arc::new(InMemoryTrace::new());
    let model = Arc::new(QueueModel::new(["direct answer"]));
    let engine = RecursiveLanguageModel::new(model, trace, vec![]);
    let session = InteractiveExecutionSession::new(ApprovalMode::InitialPlanRecursive);
    session.begin_confirmed_execution();
    let control = Arc::new(SessionExecutionControl::new(session));

    let config = RecursiveModelConfig {
        max_depth: Some(0),
        max_dynamic_depth: 0,
        max_branches: 4,
        max_prompt_characters: 4096,
        max_model_calls: 50,
        max_tool_rounds: 0,
        quality_loop: None,
    };

    let result = engine
        .run("Complex task", config, Some(control))
        .await
        .expect("run");

    assert_eq!(result.answer, "direct answer");
    assert!(result
        .metadata
        .execution_graph
        .as_ref()
        .is_some_and(|g| !g.nodes.is_empty()));
}

#[tokio::test]
async fn session_approve_node_rejects_stale_token() {
    let session = InteractiveExecutionSession::new(ApprovalMode::Full);
    let node = rlm_core::domain::types::ExecutionGraphNode {
        id: "n1".into(),
        label: "task".into(),
        prompt: Some("do work".into()),
        status: ExecutionStatus::Planned,
        ..Default::default()
    };

    let session_clone = Arc::clone(&session);
    let handle = tokio::spawn(async move {
        let control = SessionExecutionControl::new(session_clone);
        control.wait_for_node_approval(node).await
    });

    tokio::time::sleep(std::time::Duration::from_millis(50)).await;
    let token = session
        .snapshot()
        .graph
        .nodes
        .iter()
        .find(|n| n.id == "n1")
        .and_then(|n| n.approval_token.clone())
        .expect("approval token");

    assert!(session.approve_node("n1", Some("wrong-token")).is_err());
    session.approve_node("n1", Some(&token)).expect("approve");

    let decision = handle.await.expect("join");
    assert_eq!(
        decision.status,
        rlm_core::domain::types::NodeApprovalStatus::Approved
    );
}

#[tokio::test]
async fn session_stop_emits_cancelled_event() {
    let session = InteractiveExecutionSession::new(ApprovalMode::Full);
    let mut rx = session.subscribe();
    session.stop("stopped by user");

    let event = tokio::time::timeout(std::time::Duration::from_secs(1), rx.recv())
        .await
        .expect("timeout")
        .expect("event");
    assert_eq!(event.status, ExecutionStatus::Cancelled);
    assert_eq!(event.message.as_deref(), Some("stopped by user"));
}

#[tokio::test]
async fn session_duplicate_approval_token_returns_duplicate() {
    let session = InteractiveExecutionSession::new(ApprovalMode::Full);
    let node = rlm_core::domain::types::ExecutionGraphNode {
        id: "n2".into(),
        label: "task".into(),
        prompt: Some("work".into()),
        status: ExecutionStatus::Planned,
        ..Default::default()
    };

    let session_clone = Arc::clone(&session);
    tokio::spawn(async move {
        let control = SessionExecutionControl::new(session_clone);
        let _ = control.wait_for_node_approval(node).await;
    });

    tokio::time::sleep(std::time::Duration::from_millis(50)).await;
    let token = session
        .snapshot()
        .graph
        .nodes
        .iter()
        .find(|n| n.id == "n2")
        .and_then(|n| n.approval_token.clone())
        .expect("token");

    assert!(!session
        .approve_node("n2", Some(&token))
        .expect("first approve"));
    assert!(session.approve_node("n2", Some(&token)).expect("duplicate"));
}

#[test]
fn is_code_task_matches_prefixed_prompts() {
    let task = TaskNode {
        id: "c".into(),
        parent_id: None,
        prompt: "Run code: echo hi".into(),
        depth: 0,
        kind: None,
        model_override: None,
        context_policy: None,
    };
    assert!(rlm_core::domain::recursion::is_code_task(&task));
}
