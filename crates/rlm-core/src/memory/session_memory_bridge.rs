use serde_json::{json, Value};

use crate::persistence::ann_vector_index::AnnVectorIndex;
use crate::persistence::file_vector_index::{FileVectorIndex, VectorIndexRecord};

pub fn read_run_id_from_payload(payload: &Value, fallback: &str) -> String {
    payload
        .get("memory")
        .and_then(|memory| memory.get("runId"))
        .and_then(|run_id| run_id.as_str())
        .map(str::trim)
        .filter(|run_id| !run_id.is_empty())
        .map(str::to_string)
        .unwrap_or_else(|| fallback.to_string())
}

pub fn build_saved_vector_index_section(
    run_id: &str,
    records: &[VectorIndexRecord],
    embed_provider: Option<&str>,
    rebuild_needed: bool,
) -> Value {
    let status = if records.is_empty() {
        "empty"
    } else {
        "indexed"
    };
    json!({
        "version": 2,
        "status": status,
        "provider": embed_provider,
        "runId": run_id,
        "records": records,
        "rebuildNeeded": rebuild_needed,
    })
}

pub fn merge_session_vector_records(
    ann: &mut AnnVectorIndex,
    run_id: &str,
    vector_section: &Value,
) -> Result<(), std::io::Error> {
    let version = vector_section.get("version").and_then(|v| v.as_u64());
    let records = vector_section.get("records").and_then(|v| v.as_array());
    if version != Some(2) {
        return Ok(());
    }
    let Some(records) = records else {
        return Ok(());
    };
    let parsed: Vec<VectorIndexRecord> = records
        .iter()
        .filter_map(|record| serde_json::from_value(record.clone()).ok())
        .collect();
    ann.merge_session_records(run_id, &parsed)
}

pub fn export_session_vector_records(
    json_index: &FileVectorIndex,
    run_id: &str,
) -> Result<Vec<VectorIndexRecord>, std::io::Error> {
    Ok(json_index
        .read()?
        .into_iter()
        .filter(|record| record.session_id == run_id)
        .collect())
}

#[cfg(test)]
mod tests {
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
}
