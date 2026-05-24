use super::*;
use serde_json::json;
use std::fs;

fn temp_dir(name: &str) -> PathBuf {
    let dir = std::env::temp_dir().join(format!("rlm-runstate-{name}-{}", std::process::id()));
    let _ = fs::remove_dir_all(&dir);
    fs::create_dir_all(&dir).unwrap();
    dir
}

#[test]
fn create_and_mutate_run_state() {
    let dir = temp_dir("mutate");
    let store = FileRunStateStore::new(dir);
    let created = store
        .create_run("run-1", Some(json!({ "source": "test" })))
        .unwrap();
    assert_eq!(created.run_id, "run-1");
    store
        .register_capability_token("run-1", "runtime", "run-1:runtime")
        .unwrap();
    let result = store
        .mutate(
            "run-1",
            RunStateMutationRequest {
                actor: "runtime".into(),
                path: "metadata.phase".into(),
                action: "set".into(),
                value: json!("planning"),
                expected_version: 1,
                capability_token: Some("run-1:runtime".into()),
            },
        )
        .unwrap();
    assert!(result.accepted);
    let snapshot = store.get_snapshot("run-1").unwrap().unwrap();
    assert_eq!(snapshot.metadata["phase"], "planning");
}
