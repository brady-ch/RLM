use std::fs;
use std::path::PathBuf;

use rlm_core::{start_server, ServerConfig};
use serde_json::Value;

fn fixture_root() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../tests/fixtures/persistence/node-written")
}

#[tokio::test]
async fn saved_sessions_returns_list_when_configured() {
    let project_root = fixture_root();
    let server = start_server(ServerConfig {
        port: 0,
        ui_dist_dir: None,
        project_root: project_root.clone(),
        memory_session_id: Some("run-1".into()),
    })
    .await
    .expect("start server");

    let client = reqwest::Client::new();
    let response = client
        .get(format!("{}/api/saved-sessions", server.url))
        .send()
        .await
        .expect("saved sessions request");
    assert_eq!(response.status(), reqwest::StatusCode::OK);
    let body: Value = response.json().await.expect("json");
    assert_eq!(body["sessions"][0]["id"], "demo");

    server.close().await;
}

#[tokio::test]
async fn memory_returns_inspect_when_configured() {
    let project_root = fixture_root();
    let server = start_server(ServerConfig {
        port: 0,
        ui_dist_dir: None,
        project_root: project_root.clone(),
        memory_session_id: Some("run-1".into()),
    })
    .await
    .expect("start server");

    let client = reqwest::Client::new();
    let response = client
        .get(format!("{}/api/memory", server.url))
        .send()
        .await
        .expect("memory request");
    assert_eq!(response.status(), reqwest::StatusCode::OK);
    let body: Value = response.json().await.expect("json");
    assert_eq!(body["sessionId"], "run-1");
    assert!(body["scopes"]
        .as_array()
        .is_some_and(|scopes| !scopes.is_empty()));

    server.close().await;
}

#[test]
fn fixture_dirs_exist_for_control_server_wiring() {
    let root = fixture_root();
    assert!(root.join(".rlm").join("sessions").is_dir());
    assert!(root.join(".rlm").join("memory").is_dir());
    assert!(fs::read_to_string(root.join("session-load.json")).is_ok());
}
