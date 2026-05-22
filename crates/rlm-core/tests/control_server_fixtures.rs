use std::fs;
use std::path::PathBuf;

use rlm_core::{start_server, ServerConfig};
use serde_json::Value;

fn fixture(name: &str) -> Value {
    let root = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../../tests/fixtures/control-server")
        .join(name);
    let raw = fs::read_to_string(root).expect("read fixture");
    serde_json::from_str(&raw).expect("parse fixture")
}

async fn get_json(base: &str, path: &str) -> (reqwest::StatusCode, Value) {
    let client = reqwest::Client::new();
    let response = client
        .get(format!("{base}{path}"))
        .send()
        .await
        .expect("request");
    let status = response.status();
    let body: Value = response.json().await.expect("json body");
    (status, body)
}

#[tokio::test]
async fn control_server_matches_golden_fixtures() {
    let temp = tempfile::tempdir().expect("tempdir");
    let server = start_server(ServerConfig {
        port: 0,
        ui_dist_dir: None,
        project_root: temp.path().to_path_buf(),
        memory_session_id: None,
        session: None,
    })
    .await
    .expect("start server");

    let base = server.url.clone();

    let (status, body) = get_json(&base, "/api/session").await;
    assert_eq!(status, reqwest::StatusCode::OK);
    assert_eq!(body, fixture("session-idle.json"));

    let (status, body) = get_json(&base, "/api/run-mode").await;
    assert_eq!(status, reqwest::StatusCode::OK);
    assert_eq!(body, fixture("run-mode-idle.json"));

    let (status, body) = get_json(&base, "/api/saved-sessions").await;
    assert_eq!(status, reqwest::StatusCode::NOT_FOUND);
    assert_eq!(body, fixture("saved-sessions-unconfigured.json"));

    let (status, body) = get_json(&base, "/api/memory").await;
    assert_eq!(status, reqwest::StatusCode::NOT_FOUND);
    assert_eq!(body, fixture("memory-unconfigured.json"));

    let (status, body) = get_json(&base, "/api/graph-workflows").await;
    assert_eq!(status, reqwest::StatusCode::OK);
    assert_eq!(body, fixture("graph-workflows-empty.json"));

    let (status, body) = get_json(&base, "/api/model-library").await;
    assert_eq!(status, reqwest::StatusCode::NOT_FOUND);
    assert_eq!(body, fixture("model-library-unconfigured.json"));

    let (status, body) = get_json(&base, "/api/plugins").await;
    assert_eq!(status, reqwest::StatusCode::OK);
    assert_eq!(body, fixture("plugins-list-empty.json"));

    server.close().await;
}

#[tokio::test]
async fn events_stream_uses_event_stream_content_type() {
    let server = start_server(ServerConfig {
        port: 0,
        ui_dist_dir: None,
        project_root: PathBuf::from("."),
        memory_session_id: None,
        session: None,
    })
    .await
    .expect("start server");

    let client = reqwest::Client::new();
    let response = client
        .get(format!("{}/api/events", server.url))
        .header("Accept", "text/event-stream")
        .send()
        .await
        .expect("sse request");
    assert_eq!(response.status(), reqwest::StatusCode::OK);
    let content_type = response
        .headers()
        .get("content-type")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");
    assert!(content_type.contains("text/event-stream"));

    drop(response);
    server.close().await;
}

#[test]
fn idle_snapshot_serializes_for_sse_snapshot_event() {
    let session = rlm_core::InteractiveExecutionSession::new(Default::default());
    let snapshot = session.snapshot();
    let payload = serde_json::to_string(&snapshot).expect("serialize");
    assert!(payload.contains("\"status\":\"planned\""));
    assert!(payload.contains("\"approvalMode\":\"full\""));
}

#[tokio::test]
async fn root_serves_ui_placeholder_without_dist() {
    let server = start_server(ServerConfig {
        port: 0,
        ui_dist_dir: None,
        project_root: PathBuf::from("."),
        memory_session_id: None,
        session: None,
    })
    .await
    .expect("start server");

    let client = reqwest::Client::new();
    let response = client
        .get(format!("{}/", server.url))
        .send()
        .await
        .expect("root request");
    assert_eq!(response.status(), reqwest::StatusCode::OK);
    let html = response.text().await.expect("html");
    assert!(html.contains("Build the React UI"));

    server.close().await;
}
