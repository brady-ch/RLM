use std::io;
use std::path::PathBuf;

use serde::{Deserialize, Serialize};

use super::super::util::read_json_array;
use super::{
    iso_now, unique_suffix, EpisodicMemoryEntry, FileMemoryStore, MemoryScopePatchRequest,
    MemoryScopePatchResult,
};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MemoryAuditRecord {
    pub seq: u64,
    pub session_id: String,
    pub scope_id: String,
    pub actor: String,
    pub accepted: bool,
    pub reason: String,
    pub timestamp: String,
}

impl FileMemoryStore {
    pub fn list_audit(&self, session_id: &str) -> io::Result<Vec<MemoryAuditRecord>> {
        read_json_array(&self.audit_path(session_id))
    }

    pub(super) fn audit_and_result(
        &self,
        request: &MemoryScopePatchRequest,
        accepted: bool,
        reason: String,
        next_version: u32,
    ) -> io::Result<MemoryScopePatchResult> {
        let mut records = self.list_audit(&request.session_id)?;
        let seq = records.last().map(|record| record.seq).unwrap_or(0) + 1;
        records.push(MemoryAuditRecord {
            seq,
            session_id: request.session_id.clone(),
            scope_id: request.scope_id.clone(),
            actor: request.actor.clone(),
            accepted,
            reason: reason.clone(),
            timestamp: iso_now(),
        });
        self.write_json(
            &self.audit_path(&request.session_id),
            &serde_json::to_value(&records)?,
        )?;
        if !accepted {
            self.append_episodic(EpisodicMemoryEntry {
                id: format!("episode-{}", unique_suffix()),
                session_id: request.session_id.clone(),
                entry_type: "rejected_write".into(),
                summary: format!("Rejected write to {}: {}", request.scope_id, reason),
                node_id: None,
                scope_ids: Some(vec![request.scope_id.clone()]),
                timestamp: iso_now(),
            })?;
        }
        Ok(MemoryScopePatchResult {
            accepted,
            reason,
            next_version,
            audit_seq: seq,
        })
    }

    pub(super) fn audit_path(&self, session_id: &str) -> PathBuf {
        self.session_dir(session_id).join("audit.json")
    }
}
