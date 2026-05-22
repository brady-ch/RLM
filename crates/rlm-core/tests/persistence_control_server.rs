use std::fs;
use std::path::PathBuf;
use std::sync::Arc;

use rlm_core::domain::types::{ExecutionGraphNode, ExecutionStatus, GraphPosition};
use rlm_core::execution::InteractiveExecutionSession;
use rlm_core::{start_server, ServerConfig};
use serde_json::{json, Value};

fn fixture_root() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../tests/fixtures/persistence/node-written")
}

fn seeded_session() -> Arc<InteractiveExecutionSession> {
    let session = InteractiveExecutionSession::new(Default::default());
    session.register_node_for_test(ExecutionGraphNode {
        id: "root-composer".into(),
        label: "Root".into(),
        prompt: Some("persist this workflow".into()),
        status: ExecutionStatus::Ready,
        position: Some(GraphPosition { x: 0.0, y: 0.0 }),
        ..Default::default()
    });
    let child = session
        .add_node("root-composer", "child prompt", "task")
        .expect("add child");
    session
        .connect_node(&child.id, "root-composer", None, None)
        .expect("connect");
    session
}

#[tokio::test]
async fn saved_sessions_returns_list_when_configured() {
    let project_root = fixture_root();
    let server = start_server(ServerConfig {
        port: 0,
        ui_dist_dir: None,
        project_root: project_root.clone(),
        memory_session_id: Some("run-1".into()),
        session: None,
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
        session: None,
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

#[tokio::test]
async fn save_open_round_trip_restores_graph_after_mutation() {
    let temp = tempfile::tempdir().expect("tempdir");
    let project_root = temp.path().to_path_buf();
    fs::create_dir_all(project_root.join(".rlm/sessions")).expect("sessions dir");
    fs::create_dir_all(project_root.join(".rlm/memory")).expect("memory dir");

    let session = seeded_session();
    let server = start_server(ServerConfig {
        port: 0,
        ui_dist_dir: None,
        project_root,
        memory_session_id: Some("run-ui".into()),
        session: Some(session.clone()),
    })
    .await
    .expect("start server");

    let client = reqwest::Client::new();
    let save = client
        .post(format!("{}/api/saved-sessions/save", server.url))
        .json(&json!({ "id": "demo", "name": "Demo" }))
        .send()
        .await
        .expect("save request");
    assert_eq!(save.status(), reqwest::StatusCode::OK);
    let saved: Value = save.json().await.expect("save json");
    assert_eq!(saved["id"], "demo");
    assert_eq!(saved["verification"]["status"], "complete");
    assert!(saved["verification"]["sections"]
        .as_array()
        .is_some_and(|sections| sections.iter().any(|s| s["name"] == "vectorIndex")));

    let child_id = session
        .snapshot()
        .graph
        .nodes
        .iter()
        .find(|node| node.id != "root-composer")
        .map(|node| node.id.clone())
        .expect("child node");
    session
        .delete_node_with_strategy(&child_id, Some(rlm_core::domain::types::DeleteStrategy::DeleteSubtree))
        .expect("delete child");
    assert!(!session
        .snapshot()
        .graph
        .nodes
        .iter()
        .any(|node| node.id == child_id));

    let open = client
        .post(format!("{}/api/saved-sessions/demo/open", server.url))
        .send()
        .await
        .expect("open request");
    assert_eq!(open.status(), reqwest::StatusCode::OK);
    assert!(session
        .snapshot()
        .graph
        .nodes
        .iter()
        .any(|node| node.id == child_id));

    server.close().await;
}

#[tokio::test]
async fn memory_preference_round_trip_creates_and_deletes_tone() {
    let temp = tempfile::tempdir().expect("tempdir");
    let project_root = temp.path().to_path_buf();
    fs::create_dir_all(project_root.join(".rlm/memory")).expect("memory dir");

    let server = start_server(ServerConfig {
        port: 0,
        ui_dist_dir: None,
        project_root,
        memory_session_id: Some("run-ui".into()),
        session: None,
    })
    .await
    .expect("start server");

    let client = reqwest::Client::new();
    let create = client
        .post(format!("{}/api/memory/preferences", server.url))
        .json(&json!({ "key": "tone", "value": "be direct" }))
        .send()
        .await
        .expect("create preference");
    assert_eq!(create.status(), reqwest::StatusCode::OK);
    let created: Value = create.json().await.expect("created json");
    assert_eq!(
        created["scopes"]
            .as_array()
            .and_then(|scopes| {
                scopes
                    .iter()
                    .find(|scope| scope["scopeId"] == "project-preferences")
            })
            .and_then(|scope| scope.pointer("/content/tone/value"))
            .and_then(|v| v.as_str()),
        Some("be direct")
    );
    assert!(created.get("vectorIndex").is_some());

    let remove = client
        .delete(format!("{}/api/memory/preferences/tone", server.url))
        .send()
        .await
        .expect("delete preference");
    assert_eq!(remove.status(), reqwest::StatusCode::OK);
    let removed: Value = remove.json().await.expect("removed json");
    assert!(removed
        .pointer("/scopes/0/content/tone")
        .map(|v| v.is_null())
        .unwrap_or(true));

    server.close().await;
}

#[test]
fn fixture_dirs_exist_for_control_server_wiring() {
    let root = fixture_root();
    assert!(root.join(".rlm").join("sessions").is_dir());
    assert!(root.join(".rlm").join("memory").is_dir());
    assert!(fs::read_to_string(root.join("session-load.json")).is_ok());
}
