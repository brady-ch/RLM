mod audit;
mod episodic;
mod scope;

use std::io;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use serde_json::Value;

pub use audit::MemoryAuditRecord;
pub use episodic::EpisodicMemoryEntry;
pub use scope::{MemoryScopeDocument, MemoryScopePatchRequest, MemoryScopePatchResult};

use super::util::{sanitize_id, write_json_atomic};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MemoryInspectionSnapshot {
    pub session_id: String,
    pub scopes: Vec<MemoryScopeDocument>,
    pub episodic: Vec<EpisodicMemoryEntry>,
    pub packets: Vec<Value>,
    pub audit: Vec<MemoryAuditRecord>,
}

pub struct FileMemoryStore {
    pub(super) base_dir: PathBuf,
}

impl FileMemoryStore {
    pub fn new(base_dir: PathBuf) -> Self {
        Self { base_dir }
    }

    pub fn base_dir(&self) -> &Path {
        &self.base_dir
    }

    pub fn inspect(&self, session_id: &str) -> io::Result<MemoryInspectionSnapshot> {
        Ok(MemoryInspectionSnapshot {
            session_id: session_id.to_string(),
            scopes: self.list_scopes(session_id)?,
            episodic: self.list_episodic(session_id)?,
            packets: self.list_packet_metadata(session_id)?,
            audit: self.list_audit(session_id)?,
        })
    }

    pub fn restore_session_data(
        &self,
        session_id: &str,
        scopes: Vec<MemoryScopeDocument>,
        episodic: Vec<EpisodicMemoryEntry>,
        audit: Option<Vec<MemoryAuditRecord>>,
        packets: Option<Vec<Value>>,
    ) -> io::Result<()> {
        for mut scope in scopes {
            scope.session_id = session_id.to_string();
            let lifetime = scope.lifetime.clone();
            self.write_json(
                &self.scope_path_for_lifetime(session_id, &scope.scope_id, &lifetime),
                &serde_json::to_value(&scope)?,
            )?;
        }
        let trimmed_episodic: Vec<_> = episodic.into_iter().rev().take(500).rev().collect();
        self.write_json(
            &self.episodic_path(session_id),
            &serde_json::to_value(&trimmed_episodic)?,
        )?;
        if let Some(audit_records) = audit {
            self.write_json(
                &self.audit_path(session_id),
                &serde_json::to_value(&audit_records)?,
            )?;
        }
        if let Some(packet_records) = packets {
            let trimmed: Vec<_> = packet_records.into_iter().rev().take(200).rev().collect();
            self.write_json(
                &self.packet_path(session_id),
                &serde_json::to_value(&trimmed)?,
            )?;
        }
        Ok(())
    }

    pub(super) fn write_json(&self, path: &Path, value: &Value) -> io::Result<()> {
        write_json_atomic(path, value)
    }

    pub(super) fn session_dir(&self, session_id: &str) -> PathBuf {
        let safe = sanitize_id(session_id).unwrap_or_else(|_| session_id.to_string());
        self.base_dir.join(safe)
    }
}

pub(super) fn iso_now() -> String {
    time::OffsetDateTime::now_utc()
        .format(&time::format_description::well_known::Rfc3339)
        .unwrap_or_else(|_| "1970-01-01T00:00:00Z".to_string())
}

pub(super) fn unique_suffix() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    format!("{nanos}")
}

#[cfg(test)]
#[path = "../../../tests/persistence/memory_store.rs"]
mod memory_store_tests;
