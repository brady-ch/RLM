use serde_json::{json, Value};
use std::io;

use crate::persistence::ann_vector_index::AnnVectorIndex;
use crate::persistence::file_vector_index::{FileVectorIndex, VectorIndexRecord};
use crate::persistence::memory_store::{
    EpisodicMemoryEntry, FileMemoryStore, MemoryAuditRecord, MemoryScopeDocument,
};
use crate::persistence::session_store::SavedSessionPayload;

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
) -> Result<(), io::Error> {
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
) -> Result<Vec<VectorIndexRecord>, io::Error> {
    Ok(json_index
        .read()?
        .into_iter()
        .filter(|record| record.session_id == run_id)
        .collect())
}

pub fn build_saved_session_payload(
    session_snapshot: &Value,
    run_id: &str,
    memory_store: &FileMemoryStore,
    vector_index: &FileVectorIndex,
    embed_provider: Option<&str>,
    graph_workflow_metadata: Option<Value>,
) -> io::Result<SavedSessionPayload> {
    let mut artifact_refs = Vec::new();
    if let Some(nodes) = session_snapshot
        .pointer("/graph/nodes")
        .and_then(|value| value.as_array())
    {
        for node in nodes {
            let node_id = node.get("id").and_then(|v| v.as_str()).unwrap_or("");
            if let Some(refs) = node
                .get("composer")
                .and_then(|composer| composer.get("artifactRefs"))
                .and_then(|value| value.as_array())
            {
                for ref_val in refs {
                    artifact_refs.push(json!({ "nodeId": node_id, "ref": ref_val }));
                }
            }
        }
    }

    let scopes = memory_store.list_scopes(run_id)?;
    let episodic = memory_store.list_episodic(run_id)?;
    let audit = memory_store.list_audit(run_id)?;
    let packets = memory_store.list_packet_metadata(run_id)?;
    let preferences_scope = memory_store.read_scope(run_id, "project-preferences")?;
    let session_records = export_session_vector_records(vector_index, run_id)?;

    let memory = json!({
        "version": 2,
        "runId": run_id,
        "status": "saved",
        "scopes": scopes,
        "episodic": episodic,
        "audit": audit,
        "packets": packets,
    });

    let preferences = json!({
        "version": 2,
        "status": "saved",
        "preferences": preferences_scope
            .map(|scope| scope.content)
            .unwrap_or_else(|| json!({})),
    });

    let vector_index_section = build_saved_vector_index_section(
        run_id,
        &session_records,
        embed_provider,
        session_records.is_empty() && !episodic.is_empty(),
    );

    Ok(SavedSessionPayload {
        session: session_snapshot.clone(),
        run_state: None,
        artifacts: json!({
            "version": 1,
            "refs": artifact_refs,
            "policy": "refs-only",
        }),
        memory,
        preferences,
        vector_index: vector_index_section,
        graph_workflow_metadata: graph_workflow_metadata.or_else(|| Some(json!({ "version": 1 }))),
    })
}

pub fn restore_session_memory(
    payload: &SavedSessionPayload,
    memory_store: &FileMemoryStore,
    ann: &mut AnnVectorIndex,
) -> io::Result<String> {
    let wrapper = json!({ "memory": payload.memory.clone() });
    let run_id = read_run_id_from_payload(&wrapper, "run-restored");

    let version = payload.memory.get("version").and_then(|v| v.as_u64());
    let status = payload.memory.get("status").and_then(|v| v.as_str());
    if version == Some(2) && status == Some("saved") {
        let scopes: Vec<MemoryScopeDocument> = payload
            .memory
            .get("scopes")
            .and_then(|value| serde_json::from_value(value.clone()).ok())
            .unwrap_or_default();
        let episodic: Vec<EpisodicMemoryEntry> = payload
            .memory
            .get("episodic")
            .and_then(|value| serde_json::from_value(value.clone()).ok())
            .unwrap_or_default();
        let audit: Option<Vec<MemoryAuditRecord>> = payload
            .memory
            .get("audit")
            .and_then(|value| serde_json::from_value(value.clone()).ok());
        let packets: Option<Vec<Value>> = payload
            .memory
            .get("packets")
            .and_then(|value| value.as_array().cloned());
        memory_store.restore_session_data(&run_id, scopes, episodic, audit, packets)?;
    }

    merge_session_vector_records(ann, &run_id, &payload.vector_index)?;
    Ok(run_id)
}

pub fn restore_graph_workflow_metadata(
    payload: &SavedSessionPayload,
) -> (Value, bool, Option<String>) {
    let raw = payload.graph_workflow_metadata.as_ref();
    let version = raw
        .and_then(|value| value.get("version"))
        .and_then(|v| v.as_u64());
    if version != Some(1) {
        let note = "Session saved before v1.5 graph workflow metadata; workflow link not restored.";
        return (
            json!({ "version": 1, "restoreNote": note }),
            true,
            Some(note.to_string()),
        );
    }
    let metadata = json!({
        "version": 1,
        "linkedWorkflowId": raw.and_then(|v| v.get("linkedWorkflowId").cloned()),
        "lastVariant": raw.and_then(|v| v.get("lastVariant").cloned()),
        "exportedAt": raw.and_then(|v| v.get("exportedAt").cloned()),
        "restoreNote": raw.and_then(|v| v.get("restoreNote").cloned()),
    });
    (metadata, false, None)
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
