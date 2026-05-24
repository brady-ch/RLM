use super::*;
use crate::persistence::file_vector_index::{VectorIndexRecord, VectorRecordSource};
use std::fs;
use std::path::PathBuf;

fn temp_dir(name: &str) -> PathBuf {
    let dir = std::env::temp_dir().join(format!("rlm-bridge-{name}-{}", std::process::id()));
    let _ = fs::remove_dir_all(&dir);
    fs::create_dir_all(&dir).unwrap();
    dir
}

fn sample(id: &str, session: &str) -> VectorIndexRecord {
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
fn read_run_id_from_payload_prefers_saved_run_id() {
    let payload = json!({
        "memory": { "runId": "run-saved" }
    });
    assert_eq!(read_run_id_from_payload(&payload, "fallback"), "run-saved");
}

#[test]
fn merge_session_vector_records_restores_saved_vectors() {
    let dir = temp_dir("restore");
    let mut ann = AnnVectorIndex::new(dir.clone());
    let section = build_saved_vector_index_section(
        "run-restore",
        &[sample("a", "run-restore")],
        Some("ollama:nomic-embed-text"),
        false,
    );
    merge_session_vector_records(&mut ann, "run-restore", &section).unwrap();
    let records = ann.session_records("run-restore").unwrap();
    assert_eq!(records.len(), 1);
    assert_eq!(records[0].id, "a");
}
