use std::path::PathBuf;

use rlm_core::{start_server, ServerConfig};
use serde_json::{json, Value};

fn ui_dist_dir() -> Option<PathBuf> {
    let dist = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../ui/dist");
    if dist.join("index.html").is_file() {
        Some(dist)
    } else {
        None
    }
}

#[tokio::test]
async fn reg03_uat_smoke_session_includes_resource_guard() {
    let temp = tempfile::tempdir().expect("tempdir");
    let server = start_server(ServerConfig {
        port: 0,
        ui_dist_dir: ui_dist_dir(),
        project_root: temp.path().to_path_buf(),
        memory_session_id: None,
        session: None,
        ..Default::default()
    })
    .await
    .expect("start server");

    let client = reqwest::Client::new();
    let response = client
        .get(format!("{}/api/session", server.url))
        .send()
        .await
        .expect("GET /api/session");
    assert_eq!(response.status(), reqwest::StatusCode::OK);
    let body: Value = response.json().await.expect("json");
    let guard = body
        .get("resourceGuard")
        .and_then(Value::as_object)
        .expect("resourceGuard object on session snapshot");
    assert!(
        guard.contains_key("runBlocked"),
        "resourceGuard should expose runBlocked"
    );
    assert!(
        guard.contains_key("peakModelRamMb"),
        "resourceGuard should expose peakModelRamMb"
    );

    server.close().await;
}

#[tokio::test]
async fn reg03_uat_smoke_duplicate_confirm_run_returns_conflict() {
    let temp = tempfile::tempdir().expect("tempdir");
    let session = rlm_core::execution::InteractiveExecutionSession::new(Default::default());
    session.begin_confirmed_execution();

    let server = start_server(ServerConfig {
        port: 0,
        ui_dist_dir: None,
        project_root: temp.path().to_path_buf(),
        memory_session_id: None,
        session: Some(session),
        ..Default::default()
    })
    .await
    .expect("start server");

    let client = reqwest::Client::new();
    let response = client
        .post(format!("{}/api/chat/confirm-run", server.url))
        .json(&json!({ "variant": "playbook" }))
        .send()
        .await
        .expect("POST confirm-run");
    assert_eq!(response.status(), reqwest::StatusCode::CONFLICT);
    let body: Value = response.json().await.expect("json");
    assert_eq!(
        body.get("error").and_then(Value::as_str),
        Some("Execution is already running.")
    );

    server.close().await;
}
