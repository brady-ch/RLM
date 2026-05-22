use std::fs;
use std::sync::Arc;

use rlm_core::domain::run_state_persistence::{LoadedResumeState, RunStatePersistence};
use rlm_core::domain::run_state_types::ResumeCursor;
use rlm_core::persistence::FileRunStateStore;
use rlm_core::ports::RunStateStorePort;

fn temp_dir(name: &str) -> std::path::PathBuf {
    let dir = std::env::temp_dir().join(format!("rlm-run-state-{name}-{}", std::process::id()));
    let _ = fs::remove_dir_all(&dir);
    fs::create_dir_all(&dir).unwrap();
    dir
}

#[test]
fn run_state_persistence_seeds_snapshot_and_mutates_node_status() {
    let dir = temp_dir("persist");
    let store: Arc<dyn RunStateStorePort> = Arc::new(FileRunStateStore::new(dir));
    let persistence = RunStatePersistence::new("run-test", Arc::clone(&store));
    persistence
        .initialize("hello", "default")
        .expect("initialize");
    persistence
        .persist_node_status("root-composer", "running")
        .expect("persist running");
    persistence
        .persist_node_status("root-composer", "completed")
        .expect("persist completed");

    let snapshot = store
        .get_snapshot("run-test")
        .expect("get")
        .expect("exists");
    assert!(!snapshot.mutation_log.is_empty());
    assert!(snapshot
        .node_statuses
        .iter()
        .any(|entry| entry.node_id == "root-composer" && entry.status == "completed"));
}

#[test]
fn persist_resume_cursor_writes_cursor_path() {
    let dir = temp_dir("cursor");
    let store: Arc<dyn RunStateStorePort> = Arc::new(FileRunStateStore::new(dir));
    let persistence = RunStatePersistence::new("run-cursor", Arc::clone(&store));
    persistence
        .initialize("hello", "default")
        .expect("initialize");
    persistence
        .persist_resume_cursor(&ResumeCursor {
            active_node_id: "node-1".into(),
            completed_node_ids: vec!["root".into()],
            variant: "playbook".into(),
        })
        .expect("persist cursor");

    let snapshot = store
        .get_snapshot("run-cursor")
        .expect("get")
        .expect("exists");
    let cursor = snapshot.resume_cursor.expect("resume cursor");
    assert_eq!(
        cursor.get("activeNodeId").and_then(|value| value.as_str()),
        Some("node-1")
    );
}

#[test]
fn load_resume_state_merges_node_statuses_and_cursor() {
    let dir = temp_dir("load");
    let store: Arc<dyn RunStateStorePort> = Arc::new(FileRunStateStore::new(dir));
    let persistence = RunStatePersistence::new("run-load", Arc::clone(&store));
    persistence
        .initialize("hello", "default")
        .expect("initialize");
    persistence
        .persist_node_status("root", "completed")
        .expect("persist root");
    persistence
        .persist_resume_cursor(&ResumeCursor {
            active_node_id: "child".into(),
            completed_node_ids: vec!["root".into(), "child".into()],
            variant: "playbook".into(),
        })
        .expect("persist cursor");

    let loaded: LoadedResumeState = persistence
        .load_resume_state()
        .expect("load")
        .expect("state");
    assert!(loaded.completed_node_ids.contains(&"root".to_string()));
    assert!(loaded.completed_node_ids.contains(&"child".to_string()));
    assert_eq!(loaded.active_node_id.as_deref(), Some("child"));
    assert_eq!(loaded.variant.as_deref(), Some("playbook"));
}
