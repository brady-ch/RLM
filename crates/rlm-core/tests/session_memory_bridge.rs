use rlm_core::memory::{
    build_saved_session_payload, merge_session_vector_records, read_run_id_from_payload,
    restore_graph_workflow_metadata, restore_session_memory,
};
use rlm_core::persistence::ann_vector_index::AnnVectorIndex;
use rlm_core::persistence::file_vector_index::{FileVectorIndex, VectorIndexRecord, VectorRecordSource};
use rlm_core::persistence::memory_store::{EpisodicMemoryEntry, FileMemoryStore, MemoryScopeDocument};
use rlm_core::persistence::session_store::SavedSessionPayload;
use serde_json::json;
use std::fs;
use std::path::PathBuf;

fn temp_dir(name: &str) -> PathBuf {
    let dir = std::env::temp_dir().join(format!("rlm-bridge-it-{name}-{}", std::process::id()));
    let _ = fs::remove_dir_all(&dir);
    fs::create_dir_all(&dir).unwrap();
    dir
}

fn sample_record(id: &str, session: &str) -> VectorIndexRecord {
    VectorIndexRecord {
        id: id.into(),
        session_id: session.into(),
        scope_id: "notes".into(),
        source: VectorRecordSource::Scope,
        text: id.into(),
        embedding: vec![1.0, 0.0],
        updated_at: "2026-05-22T00:00:00Z".into(),
    }
}

#[test]
fn build_saved_session_payload_exports_live_memory_and_vectors() {
    let dir = temp_dir("save");
    let memory_dir = dir.join("memory");
    fs::create_dir_all(&memory_dir).unwrap();
    let store = FileMemoryStore::new(memory_dir.clone());
    let run_id = "run-save";
    store
        .restore_session_data(
            run_id,
            vec![MemoryScopeDocument {
                session_id: run_id.into(),
                scope_id: "notes".into(),
                lifetime: "session".into(),
                version: 1,
                content: json!({ "text": "saved scope" }),
                updated_at: "2026-05-22T00:00:00Z".into(),
            }],
            vec![EpisodicMemoryEntry {
                id: "ep-1".into(),
                session_id: run_id.into(),
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

    let vector_path = memory_dir.join("vector-index.json");
    let mut vector_index = FileVectorIndex::new(vector_path);
    vector_index
        .merge_session_records(run_id, &[sample_record("vec-1", run_id)])
        .unwrap();

    let snapshot = json!({
        "graph": {
            "nodes": [{
                "id": "root-composer",
                "composer": { "artifactRefs": [{ "path": "out.txt" }] }
            }],
            "edges": []
        }
    });

    let payload = build_saved_session_payload(
        &snapshot,
        run_id,
        &store,
        &vector_index,
        Some("ollama:nomic-embed-text"),
        None,
    )
    .expect("build payload");

    assert_eq!(payload.memory["runId"], run_id);
    assert_eq!(payload.memory["status"], "saved");
    assert!(payload.memory["scopes"].as_array().is_some_and(|s| !s.is_empty()));
    assert!(payload.vector_index["records"]
        .as_array()
        .is_some_and(|records| !records.is_empty()));
}

#[test]
fn restore_session_memory_rebinds_scopes_and_vectors() {
    let dir = temp_dir("restore");
    let memory_dir = dir.join("memory");
    fs::create_dir_all(&memory_dir).unwrap();
    let store = FileMemoryStore::new(memory_dir.clone());
    let payload = SavedSessionPayload {
        session: json!({ "graph": { "nodes": [], "edges": [] } }),
        run_state: None,
        artifacts: json!({ "version": 1, "refs": [], "policy": "refs-only" }),
        memory: json!({
            "version": 2,
            "runId": "run-restored",
            "status": "saved",
            "scopes": [{
                "sessionId": "run-old",
                "scopeId": "notes",
                "lifetime": "session",
                "version": 1,
                "content": { "text": "restored" },
                "updatedAt": "2026-05-22T00:00:00Z"
            }],
            "episodic": [],
            "audit": [],
            "packets": []
        }),
        preferences: json!({ "version": 2, "status": "saved", "preferences": {} }),
        vector_index: json!({
            "version": 2,
            "status": "indexed",
            "runId": "run-restored",
            "records": [sample_record("vec-restore", "run-restored")],
            "rebuildNeeded": false
        }),
        graph_workflow_metadata: Some(json!({ "version": 1 })),
    };

    let mut ann = AnnVectorIndex::new(memory_dir);
    let run_id = restore_session_memory(&payload, &store, &mut ann).expect("restore");
    assert_eq!(run_id, "run-restored");
    let scope = store
        .read_scope("run-restored", "notes")
        .expect("read")
        .expect("scope");
    assert_eq!(scope.session_id, "run-restored");
    assert_eq!(scope.content["text"], "restored");
    assert_eq!(ann.session_records("run-restored").unwrap().len(), 1);
}

#[test]
fn merge_session_vector_records_preserves_other_sessions() {
    let dir = temp_dir("merge");
    let mut ann = AnnVectorIndex::new(dir);
    ann.merge_session_records("run-a", &[sample_record("a1", "run-a")])
        .unwrap();
    let section = json!({
        "version": 2,
        "records": [sample_record("b1", "run-b")]
    });
    merge_session_vector_records(&mut ann, "run-b", &section).unwrap();
    assert_eq!(ann.session_records("run-a").unwrap().len(), 1);
    assert_eq!(ann.session_records("run-b").unwrap().len(), 1);
}

#[test]
fn read_run_id_from_payload_uses_fallback_when_missing() {
    assert_eq!(
        read_run_id_from_payload(&json!({ "memory": {} }), "fallback-run"),
        "fallback-run"
    );
}

#[test]
fn restore_graph_workflow_metadata_marks_degraded_when_missing() {
    let payload = SavedSessionPayload {
        session: json!({}),
        run_state: None,
        artifacts: json!({}),
        memory: json!({}),
        preferences: json!({}),
        vector_index: json!({}),
        graph_workflow_metadata: None,
    };
    let (metadata, degraded, note) = restore_graph_workflow_metadata(&payload);
    assert!(degraded);
    assert!(note.is_some());
    assert_eq!(metadata["version"], 1);
}
