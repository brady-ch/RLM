use std::path::PathBuf;
use std::sync::Arc;

use rlm_core::domain::types::{
    ClarificationQuestion, ExecutionGraphNode, ExecutionStatus, GraphPosition,
};
use rlm_core::execution::InteractiveExecutionSession;
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
