use super::*;
use serde_json::json;
use std::fs;

fn temp_dir(name: &str) -> PathBuf {
    let dir = std::env::temp_dir().join(format!("rlm-session-{name}-{}", std::process::id()));
    let _ = fs::remove_dir_all(&dir);
    fs::create_dir_all(&dir).unwrap();
    dir
}

#[test]
fn save_and_load_complete_bundle() {
    let dir = temp_dir("complete");
    let store = FileSessionStore::new(dir.clone());
    let saved = store
        .save(SaveSessionRequest {
            id: Some("demo".into()),
            name: Some("Demo".into()),
            payload: SavedSessionPayload {
                session: json!({ "graph": { "nodes": [], "edges": [] }, "status": "planned" }),
                run_state: None,
                artifacts: json!({ "refs": [] }),
                memory: json!({ "status": "contract_saved", "scopes": [] }),
                preferences: json!({ "status": "contract_saved", "preferences": [] }),
                vector_index: json!({ "status": "not_indexed", "rebuildNeeded": true }),
                graph_workflow_metadata: None,
            },
        })
        .unwrap();

    assert_eq!(saved.summary.status, "complete");
    assert!(!saved.verification.unsafe_to_continue);
    assert!(saved.verification.missing.is_empty());

    let loaded = store.load("demo").unwrap();
    assert_eq!(
        loaded.payload.vector_index,
        json!({ "status": "not_indexed", "rebuildNeeded": true })
    );
}
