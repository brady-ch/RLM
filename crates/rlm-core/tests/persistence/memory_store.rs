use super::*;
use serde_json::json;
use std::fs;

fn temp_dir(name: &str) -> PathBuf {
    let dir = std::env::temp_dir().join(format!("rlm-memory-{name}-{}", std::process::id()));
    let _ = fs::remove_dir_all(&dir);
    fs::create_dir_all(&dir).unwrap();
    dir
}

#[test]
fn patch_scope_enforces_acl_and_version() {
    let dir = temp_dir("acl");
    let store = FileMemoryStore::new(dir);
    let first = store
        .patch_scope(MemoryScopePatchRequest {
            session_id: "run-1".into(),
            scope_id: "project-facts".into(),
            actor: "node-a".into(),
            expected_version: 0,
            allowed_scopes: vec!["project-facts".into()],
            writes: vec!["memory updates".into()],
            patch: json!({ "language": "TypeScript" }),
            lifetime: Some("project".into()),
        })
        .unwrap();
    assert!(first.accepted);
    assert_eq!(first.next_version, 1);

    let conflict = store
        .patch_scope(MemoryScopePatchRequest {
            session_id: "run-1".into(),
            scope_id: "project-facts".into(),
            actor: "node-b".into(),
            expected_version: 0,
            allowed_scopes: vec!["project-facts".into()],
            writes: vec!["memory updates".into()],
            patch: json!({ "runtime": "node" }),
            lifetime: None,
        })
        .unwrap();
    assert!(!conflict.accepted);
    assert_eq!(conflict.reason, "etag/version conflict");
}

#[test]
fn restore_session_data_rebinds_scopes_under_new_run_id() {
    let dir = temp_dir("restore");
    let store = FileMemoryStore::new(dir);
    let scope = MemoryScopeDocument {
        session_id: "run-old".into(),
        scope_id: "notes".into(),
        lifetime: "session".into(),
        version: 1,
        content: json!({ "text": "hello" }),
        updated_at: "2026-05-22T00:00:00Z".into(),
    };
    store
        .restore_session_data(
            "run-new",
            vec![scope],
            vec![EpisodicMemoryEntry {
                id: "ep-1".into(),
                session_id: "run-old".into(),
                entry_type: "scope_write".into(),
                summary: "saved".into(),
                node_id: None,
                scope_ids: None,
                timestamp: "2026-05-22T00:00:00Z".into(),
            }],
            None,
            None,
        )
        .unwrap();
    let restored = store
        .read_scope("run-new", "notes")
        .unwrap()
        .expect("scope");
    assert_eq!(restored.session_id, "run-new");
    assert_eq!(restored.content["text"], "hello");
}
