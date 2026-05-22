use std::fs;
use std::path::PathBuf;

use rlm_core::persistence::{
    load_project_config, FileMemoryStore, FileRunStateStore, FileSessionStore,
};
use serde_json::Value;

fn fixture_root() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../tests/fixtures/persistence/node-written")
}

fn read_fixture(name: &str) -> Value {
    let path = fixture_root().join(name);
    let raw = fs::read_to_string(path).expect("read fixture");
    serde_json::from_str(&raw).expect("parse fixture")
}

#[test]
fn rust_reads_node_written_session_bundle() {
    let root = fixture_root();
    let store = FileSessionStore::new(root.join(".rlm").join("sessions"));
    let loaded = store.load("demo").expect("load session");
    let expected: Value = read_fixture("session-load.json");

    assert_eq!(loaded.summary.id, expected["id"].as_str().unwrap());
    assert_eq!(loaded.summary.status, expected["status"].as_str().unwrap());
    assert_eq!(
        loaded.payload.vector_index,
        expected["payload"]["vectorIndex"]
    );
    assert_eq!(
        loaded.verification.status,
        expected["verification"]["status"]
    );
}

#[test]
fn rust_session_list_matches_node_written_fixture() {
    let root = fixture_root();
    let store = FileSessionStore::new(root.join(".rlm").join("sessions"));
    let list = store.list().expect("list sessions");
    let expected = read_fixture("session-list.json");
    let expected_sessions = expected["sessions"].as_array().expect("sessions array");
    assert_eq!(list.len(), expected_sessions.len());
    for (actual, expected) in list.iter().zip(expected_sessions.iter()) {
        assert_eq!(actual.id, expected["id"]);
        assert_eq!(actual.name, expected["name"]);
        assert_eq!(actual.status, expected["status"]);
        assert_eq!(actual.created_at, expected["createdAt"]);
        assert_eq!(actual.updated_at, expected["updatedAt"]);
        assert!(actual.path.ends_with("sessions/demo"));
    }
}

#[test]
fn rust_reads_node_written_memory_store() {
    let root = fixture_root();
    let store = FileMemoryStore::new(root.join(".rlm").join("memory"));
    let inspect = store.inspect("run-1").expect("inspect memory");
    let actual = serde_json::to_value(inspect).expect("serialize");
    let expected = read_fixture("memory-inspect.json");
    assert_eq!(actual, expected);
}

#[test]
fn rust_reads_node_written_run_state() {
    let root = fixture_root();
    let store = FileRunStateStore::new(root.join(".planning").join("runs"));
    let snapshot = store
        .get_snapshot("run-1")
        .expect("get snapshot")
        .expect("exists");
    let actual = serde_json::to_value(snapshot).expect("serialize");
    let expected = read_fixture("run-state-snapshot.json");
    assert_eq!(actual, expected);
}

#[test]
fn config_loader_accepts_project_rlm_config() {
    let project_root = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../..");
    let loaded = load_project_config(&project_root, None).expect("load config");
    assert!(loaded.config.get("agents").is_some());
    assert!(loaded.config.get("workflows").is_some());
}
