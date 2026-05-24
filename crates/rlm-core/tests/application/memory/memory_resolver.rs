use super::*;
use std::fs;

fn temp_store(name: &str) -> FileMemoryStore {
    let dir = std::env::temp_dir().join(format!("rlm-resolver-{name}-{}", std::process::id()));
    let _ = fs::remove_dir_all(&dir);
    fs::create_dir_all(&dir).unwrap();
    FileMemoryStore::new(dir)
}

#[tokio::test]
async fn build_packet_includes_scope_and_rolling_summary() {
    let store = temp_store("packet");
    store
        .patch_scope(crate::persistence::MemoryScopePatchRequest {
            session_id: "run-1".into(),
            scope_id: "project-facts".into(),
            actor: "test".into(),
            expected_version: 0,
            allowed_scopes: vec!["project-facts".into()],
            writes: vec!["memory updates".into()],
            patch: serde_json::json!({ "goal": "persist structured memory" }),
            lifetime: Some("session".into()),
        })
        .expect("patch scope");

    let resolver = MemoryResolver::new(store, "run-1", None);
    resolver
        .append_node_summary("task-1", "Implemented the scope document store.", &[
            "project-facts".into(),
        ])
        .expect("append summary");

    let packet = resolver
        .build_packet(
            "task-2",
            "persist memory",
            &ComposerContextPolicy {
                reads: vec!["rolling summary".into()],
                writes: vec!["memory updates".into()],
                limits: vec!["1200 characters".into()],
                memory_scopes: vec!["project-facts".into()],
            },
        )
        .await
        .expect("build packet")
        .expect("packet present");

    assert!(packet.text.contains("<memory_context>"));
    assert!(packet.text.contains("persist structured memory"));
    assert!(packet.text.contains("Implemented the scope document store."));
    assert!(!packet.metadata.degraded);
    assert!(!packet.metadata.truncated);
}

#[tokio::test]
async fn build_packet_returns_none_when_no_scopes() {
    let store = temp_store("empty");
    let resolver = MemoryResolver::new(store, "run-1", None);
    let packet = resolver
        .build_packet(
            "task-1",
            "hello",
            &ComposerContextPolicy {
                reads: vec![],
                writes: vec![],
                limits: vec![],
                memory_scopes: vec![],
            },
        )
        .await
        .expect("build packet");
    assert!(packet.is_none());
}
