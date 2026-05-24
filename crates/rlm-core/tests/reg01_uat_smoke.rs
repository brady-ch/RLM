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

async fn post_json(base: &str, path: &str, body: Value) -> (reqwest::StatusCode, Value) {
    let client = reqwest::Client::new();
    let response = client
        .post(format!("{base}{path}"))
        .json(&body)
        .send()
        .await
        .expect("request");
    let status = response.status();
    let body: Value = response.json().await.unwrap_or(Value::Null);
    (status, body)
}

#[tokio::test]
async fn reg01_uat_smoke_serves_ui_and_core_api_routes() {
    let temp = tempfile::tempdir().expect("tempdir");
    let ui_dist = ui_dist_dir();
    assert!(
        ui_dist.is_some(),
        "run npm run build:ui before reg01_uat_smoke (ui/dist/index.html missing)"
    );

    let server = start_server(ServerConfig {
        port: 0,
        ui_dist_dir: ui_dist,
        project_root: temp.path().to_path_buf(),
        memory_session_id: None,
        session: None,
        ..Default::default()
    })
    .await
    .expect("start server");

    let base = server.url.clone();
    let client = reqwest::Client::new();

    let index = client.get(format!("{base}/")).send().await.expect("GET /");
    assert_eq!(index.status(), reqwest::StatusCode::OK);
    let html = index.text().await.expect("html body");
    assert!(
        html.contains("RLM Flow"),
        "built UI index should contain RLM Flow title"
    );

    let session = client
        .get(format!("{base}/api/session"))
        .send()
        .await
        .expect("GET /api/session");
    assert_eq!(session.status(), reqwest::StatusCode::OK);

    let (pause_status, pause_body) =
        post_json(&base, "/api/pause-future-auto-approvals", json!({})).await;
    assert_eq!(pause_status, reqwest::StatusCode::OK);
    assert_eq!(
        pause_body
            .pointer("/autoApprovalPaused")
            .and_then(Value::as_bool),
        Some(true)
    );

    let (download_status, _) = post_json(
        &base,
        "/api/model-library/download",
        json!({ "model": "  " }),
    )
    .await;
    assert!(
        download_status.is_client_error() || download_status.is_server_error(),
        "download with empty model should fail fast, got {download_status}"
    );

    server.close().await;
}

#[tokio::test]
async fn reg01_uat_smoke_model_library_catalog_when_unconfigured() {
    let temp = tempfile::tempdir().expect("tempdir");
    let server = start_server(ServerConfig {
        port: 0,
        ui_dist_dir: None,
        project_root: temp.path().to_path_buf(),
        memory_session_id: None,
        session: None,
        ..Default::default()
    })
    .await
    .expect("start server");

    let client = reqwest::Client::new();
    let response = client
        .get(format!("{}/api/saved-sessions", server.url))
        .send()
        .await
        .expect("GET /api/saved-sessions");
    assert_eq!(response.status(), reqwest::StatusCode::NOT_FOUND);

    server.close().await;
}
