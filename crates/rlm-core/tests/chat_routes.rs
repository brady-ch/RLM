use std::path::PathBuf;
use std::sync::Arc;

use rlm_core::domain::run_state_persistence::RunStatePersistence;
use rlm_core::domain::run_state_types::ResumeCursor;
use rlm_core::domain::types::{
    ApprovalMode, ClarificationQuestion, ExecutionGraphNode, ExecutionStatus, ExpertRuntimeMode,
    GraphPosition,
};
use rlm_core::execution::InteractiveExecutionSession;
use rlm_core::persistence::FileRunStateStore;
use rlm_core::ports::{LanguageModel, QueueModel, RunStateStorePort};
use rlm_core::{start_server, ServerConfig};
use serde_json::json;

fn seeded_session() -> Arc<InteractiveExecutionSession> {
    let session = InteractiveExecutionSession::new(Default::default());
    session.register_node_for_test(ExecutionGraphNode {
        id: "root-composer".into(),
        label: "Root".into(),
        prompt: Some("{{input}}".into()),
        status: ExecutionStatus::Ready,
        position: Some(GraphPosition { x: 0.0, y: 0.0 }),
        ..Default::default()
    });
    session
}

#[tokio::test]
async fn chat_message_returns_proposal_for_edit_command() {
    let session = seeded_session();
    let server = start_server(ServerConfig {
        port: 0,
        ui_dist_dir: None,
        project_root: PathBuf::from("."),
        memory_session_id: None,
        session: Some(session),
        ..Default::default()
    })
    .await
    .expect("start server");

    let client = reqwest::Client::new();
    let response = client
        .post(format!("{}/api/chat/message", server.url))
        .json(&json!({ "message": "edit root-composer: new prompt" }))
        .send()
        .await
        .expect("chat message");
    assert_eq!(response.status(), reqwest::StatusCode::OK);
    let body: serde_json::Value = response.json().await.expect("json");
    assert!(body.get("proposal").is_some());
    assert!(body["proposal"]["summary"]
        .as_str()
        .is_some_and(|summary| summary.contains("root-composer")));

    server.close().await;
}

#[tokio::test]
async fn chat_apply_and_cancel_mutate_pending_mutation() {
    let session = seeded_session();
    let server = start_server(ServerConfig {
        port: 0,
        ui_dist_dir: None,
        project_root: PathBuf::from("."),
        memory_session_id: None,
        session: Some(session.clone()),
        ..Default::default()
    })
    .await
    .expect("start server");

    let client = reqwest::Client::new();
    let preview = client
        .post(format!("{}/api/chat/message", server.url))
        .json(&json!({ "message": "edit root-composer: applied prompt" }))
        .send()
        .await
        .expect("preview");
    let preview_body: serde_json::Value = preview.json().await.expect("preview json");
    let proposal_id = preview_body["proposal"]["id"]
        .as_str()
        .expect("proposal id");

    let apply = client
        .post(format!("{}/api/chat/apply", server.url))
        .json(&json!({ "proposalId": proposal_id }))
        .send()
        .await
        .expect("apply");
    assert_eq!(apply.status(), reqwest::StatusCode::OK);
    assert_eq!(
        session
            .snapshot()
            .graph
            .nodes
            .iter()
            .find(|node| node.id == "root-composer")
            .and_then(|node| node.prompt.as_deref()),
        Some("applied prompt")
    );

    let preview_again = client
        .post(format!("{}/api/chat/message", server.url))
        .json(&json!({ "message": "edit root-composer: pending again" }))
        .send()
        .await
        .expect("preview again");
    assert_eq!(preview_again.status(), reqwest::StatusCode::OK);

    let cancel = client
        .post(format!("{}/api/chat/cancel", server.url))
        .send()
        .await
        .expect("cancel");
    assert_eq!(cancel.status(), reqwest::StatusCode::OK);
    let cancel_body: serde_json::Value = cancel.json().await.expect("cancel json");
    assert!(cancel_body["chat"]["pendingMutation"].is_null());

    server.close().await;
}

#[tokio::test]
async fn chat_confirm_run_pipeline_variant_returns_run_variant() {
    let session = seeded_session();
    let server = start_server(ServerConfig {
        port: 0,
        ui_dist_dir: None,
        project_root: PathBuf::from("."),
        memory_session_id: None,
        session: Some(session.clone()),
        ..Default::default()
    })
    .await
    .expect("start server");

    let client = reqwest::Client::new();
    let response = client
        .post(format!("{}/api/chat/confirm-run", server.url))
        .json(&json!({ "variant": "pipeline", "input": "hello pipeline" }))
        .send()
        .await
        .expect("confirm run");
    assert_eq!(response.status(), reqwest::StatusCode::OK);
    let body: serde_json::Value = response.json().await.expect("json");
    assert_eq!(body["runVariant"], "pipeline");
    assert_eq!(
        session
            .snapshot()
            .graph
            .nodes
            .iter()
            .find(|node| node.id == "root-composer")
            .and_then(|node| node.prompt.as_deref()),
        Some("hello pipeline")
    );

    server.close().await;
}

#[tokio::test]
async fn clarifications_abort_stops_session_for_active_question() {
    let session = seeded_session();
    session.register_pending_clarification_for_test(ClarificationQuestion {
        question_id: "q-1".into(),
        node_id: "root-composer".into(),
        prompt_text: "Need input".into(),
        asked_at: "2026-05-22T00:00:00Z".into(),
    });
    let server = start_server(ServerConfig {
        port: 0,
        ui_dist_dir: None,
        project_root: PathBuf::from("."),
        memory_session_id: None,
        session: Some(session.clone()),
        ..Default::default()
    })
    .await
    .expect("start server");

    let client = reqwest::Client::new();
    let response = client
        .post(format!("{}/api/clarifications/abort", server.url))
        .json(&json!({ "questionId": "q-1" }))
        .send()
        .await
        .expect("abort");
    assert_eq!(response.status(), reqwest::StatusCode::OK);
    assert_eq!(session.snapshot().status, ExecutionStatus::Cancelled);

    server.close().await;
}

fn make_resume_graph_node(id: &str, parent_id: Option<&str>, depth: i32) -> ExecutionGraphNode {
    ExecutionGraphNode {
        id: id.into(),
        label: id.into(),
        prompt: Some(format!("{id} task")),
        parent_id: parent_id.map(str::to_string),
        depth,
        status: ExecutionStatus::Ready,
        expert_agent_id: Some("default".into()),
        expert_runtime: Some(ExpertRuntimeMode::SinglePass),
        ..Default::default()
    }
}

fn seed_resumable_run_state(
    project_root: &std::path::Path,
    run_id: &str,
) -> Arc<dyn RunStateStorePort> {
    let run_state_dir = project_root.join(".planning/runs");
    std::fs::create_dir_all(&run_state_dir).expect("run state dir");
    let store: Arc<dyn RunStateStorePort> = Arc::new(FileRunStateStore::new(run_state_dir));
    let run_state = RunStatePersistence::new(run_id, Arc::clone(&store));
    run_state
        .initialize("root task", "default")
        .expect("initialize");
    run_state
        .persist_node_status("root", "completed")
        .expect("persist root completed");
    run_state
        .persist_resume_cursor(&ResumeCursor {
            active_node_id: "child".into(),
            completed_node_ids: vec!["root".into()],
            variant: "playbook".into(),
        })
        .expect("persist cursor");
    store
}

fn seeded_resume_session() -> Arc<InteractiveExecutionSession> {
    let session = InteractiveExecutionSession::new(ApprovalMode::InitialPlanRecursive);
    session.register_node_for_test(make_resume_graph_node("root", None, 0));
    session.register_node_for_test(make_resume_graph_node("child", None, 0));
    session
}

#[tokio::test]
async fn session_includes_run_state_resumable_when_cursor_persisted() {
    let dir = tempfile::tempdir().expect("tempdir");
    let run_id = "run-resume-session";
    seed_resumable_run_state(dir.path(), run_id);
    let session = seeded_resume_session();

    let server = start_server(ServerConfig {
        port: 0,
        ui_dist_dir: None,
        project_root: dir.path().to_path_buf(),
        memory_session_id: Some(run_id.into()),
        session: Some(session),
        ..Default::default()
    })
    .await
    .expect("start server");

    let client = reqwest::Client::new();
    let response = client
        .get(format!("{}/api/session", server.url))
        .send()
        .await
        .expect("session");
    assert_eq!(response.status(), reqwest::StatusCode::OK);
    let body: serde_json::Value = response.json().await.expect("json");
    assert_eq!(body["runState"]["resumable"], true);
    assert_eq!(body["runState"]["activeNodeId"], "child");

    server.close().await;
}

#[tokio::test]
async fn session_run_state_not_resumable_while_running() {
    let dir = tempfile::tempdir().expect("tempdir");
    let run_id = "run-resume-running";
    seed_resumable_run_state(dir.path(), run_id);
    let session = seeded_resume_session();
    session.begin_confirmed_execution();

    let server = start_server(ServerConfig {
        port: 0,
        ui_dist_dir: None,
        project_root: dir.path().to_path_buf(),
        memory_session_id: Some(run_id.into()),
        session: Some(session),
        ..Default::default()
    })
    .await
    .expect("start server");

    let client = reqwest::Client::new();
    let response = client
        .get(format!("{}/api/session", server.url))
        .send()
        .await
        .expect("session");
    assert_eq!(response.status(), reqwest::StatusCode::OK);
    let body: serde_json::Value = response.json().await.expect("json");
    assert_eq!(body["runState"]["resumable"], false);

    server.close().await;
}

#[tokio::test]
async fn chat_resume_run_rejects_without_confirm() {
    let dir = tempfile::tempdir().expect("tempdir");
    let run_id = "run-resume-reject";
    seed_resumable_run_state(dir.path(), run_id);
    let session = seeded_resume_session();

    let server = start_server(ServerConfig {
        port: 0,
        ui_dist_dir: None,
        project_root: dir.path().to_path_buf(),
        memory_session_id: Some(run_id.into()),
        session: Some(session),
        ..Default::default()
    })
    .await
    .expect("start server");

    let client = reqwest::Client::new();
    for body in [json!({}), json!({ "confirm": false })] {
        let response = client
            .post(format!("{}/api/chat/resume-run", server.url))
            .json(&body)
            .send()
            .await
            .expect("resume-run");
        assert_eq!(response.status(), reqwest::StatusCode::BAD_REQUEST);
        let err_body: serde_json::Value = response.json().await.expect("json");
        assert!(err_body["error"]
            .as_str()
            .is_some_and(|msg| msg.contains("explicit user confirmation")));
    }

    server.close().await;
}

#[tokio::test]
async fn chat_resume_run_accepts_confirm_and_skips_completed_nodes() {
    let dir = tempfile::tempdir().expect("tempdir");
    let run_id = "run-resume-accept";
    seed_resumable_run_state(dir.path(), run_id);
    let session = seeded_resume_session();
    let model = Arc::new(QueueModel::new(["done"]));

    let server = start_server(ServerConfig {
        port: 0,
        ui_dist_dir: None,
        project_root: dir.path().to_path_buf(),
        memory_session_id: Some(run_id.into()),
        session: Some(session.clone()),
        exec_model: Some(Arc::clone(&model) as Arc<dyn LanguageModel>),
        ..Default::default()
    })
    .await
    .expect("start server");

    let client = reqwest::Client::new();
    let response = client
        .post(format!("{}/api/chat/resume-run", server.url))
        .json(&json!({ "confirm": true }))
        .send()
        .await
        .expect("resume-run");
    assert_eq!(response.status(), reqwest::StatusCode::OK);
    let body: serde_json::Value = response.json().await.expect("json");
    assert_eq!(body["resumed"], true);
    assert_eq!(body["runId"], run_id);

    let deadline = tokio::time::Instant::now() + std::time::Duration::from_secs(5);
    loop {
        let snap = session.snapshot();
        if snap.status != ExecutionStatus::Running {
            break;
        }
        if tokio::time::Instant::now() >= deadline {
            panic!("timed out waiting for resume execution to finish");
        }
        tokio::time::sleep(std::time::Duration::from_millis(50)).await;
    }

    let nodes = session.snapshot().graph.nodes;
    let root = nodes.iter().find(|n| n.id == "root").expect("root");
    let child = nodes.iter().find(|n| n.id == "child").expect("child");
    assert_eq!(root.status, ExecutionStatus::Completed);
    assert_eq!(child.status, ExecutionStatus::Completed);

    server.close().await;
}
