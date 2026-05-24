use std::collections::HashMap;
use std::collections::HashSet;
use std::fs;
use std::io;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

use super::util::{read_json_array, sanitize_id, write_json_atomic};
use crate::domain::types::MemoryPacketMetadata;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MemoryScopeDocument {
    pub session_id: String,
    pub scope_id: String,
    pub lifetime: String,
    pub version: u32,
    pub content: Value,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EpisodicMemoryEntry {
    pub id: String,
    pub session_id: String,
    #[serde(rename = "type")]
    pub entry_type: String,
    pub summary: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub node_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub scope_ids: Option<Vec<String>>,
    pub timestamp: String,
}

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

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MemoryInspectionSnapshot {
    pub session_id: String,
    pub scopes: Vec<MemoryScopeDocument>,
    pub episodic: Vec<EpisodicMemoryEntry>,
    pub packets: Vec<Value>,
    pub audit: Vec<MemoryAuditRecord>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MemoryScopePatchRequest {
    pub session_id: String,
    pub scope_id: String,
    pub actor: String,
    pub expected_version: u32,
    pub allowed_scopes: Vec<String>,
    pub writes: Vec<String>,
    pub patch: Value,
    #[serde(default)]
    pub lifetime: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MemoryScopePatchResult {
    pub accepted: bool,
    pub reason: String,
    pub next_version: u32,
    pub audit_seq: u64,
}

pub struct FileMemoryStore {
    base_dir: PathBuf,
}

impl FileMemoryStore {
    pub fn new(base_dir: PathBuf) -> Self {
        Self { base_dir }
    }

    pub fn base_dir(&self) -> &Path {
        &self.base_dir
    }

    pub fn read_scope(
        &self,
        session_id: &str,
        scope_id: &str,
    ) -> io::Result<Option<MemoryScopeDocument>> {
        for path in self.scope_read_paths(session_id, scope_id) {
            match fs::read_to_string(&path) {
                Ok(raw) => {
                    return serde_json::from_str(&raw).map_err(|err| {
                        io::Error::new(io::ErrorKind::InvalidData, err.to_string())
                    });
                }
                Err(err) if err.kind() == io::ErrorKind::NotFound => continue,
                Err(err) => return Err(err),
            }
        }
        Ok(None)
    }

    pub fn list_scopes(&self, session_id: &str) -> io::Result<Vec<MemoryScopeDocument>> {
        let mut documents = HashMap::new();
        for dir in self.scope_list_dirs(session_id) {
            for document in self.read_scope_dir(&dir)? {
                documents.insert(
                    format!("{}:{}", document.lifetime, document.scope_id),
                    document,
                );
            }
        }
        let mut values: Vec<_> = documents.into_values().collect();
        values.sort_by(|a, b| {
            format!("{}:{}", a.lifetime, a.scope_id).cmp(&format!("{}:{}", b.lifetime, b.scope_id))
        });
        Ok(values)
    }

    pub fn patch_scope(
        &self,
        request: MemoryScopePatchRequest,
    ) -> io::Result<MemoryScopePatchResult> {
        if let Some(reason) = self.authorize(&request) {
            return self.audit_and_result(&request, false, reason, request.expected_version);
        }
        let existing = self.read_scope(&request.session_id, &request.scope_id)?;
        let current_version = existing.as_ref().map(|doc| doc.version).unwrap_or(0);
        if request.expected_version != current_version {
            return self.audit_and_result(
                &request,
                false,
                "etag/version conflict".into(),
                current_version,
            );
        }

        let lifetime = request
            .lifetime
            .clone()
            .or_else(|| existing.as_ref().map(|doc| doc.lifetime.clone()))
            .unwrap_or_else(|| "session".to_string());
        let content = apply_patch(
            existing
                .as_ref()
                .map(|doc| doc.content.clone())
                .unwrap_or_else(|| json!({})),
            request.patch.clone(),
        );
        let next = MemoryScopeDocument {
            session_id: request.session_id.clone(),
            scope_id: request.scope_id.clone(),
            lifetime: lifetime.clone(),
            version: current_version + 1,
            content,
            updated_at: iso_now(),
        };
        self.write_json(
            &self.scope_path_for_lifetime(&request.session_id, &request.scope_id, &lifetime),
            &serde_json::to_value(&next)?,
        )?;
        self.append_episodic(EpisodicMemoryEntry {
            id: format!("episode-{}", unique_suffix()),
            session_id: request.session_id.clone(),
            entry_type: "scope_write".into(),
            summary: format!("Scope {} updated by {}.", request.scope_id, request.actor),
            node_id: None,
            scope_ids: Some(vec![request.scope_id.clone()]),
            timestamp: iso_now(),
        })?;
        self.audit_and_result(&request, true, "accepted".into(), next.version)
    }

    pub fn list_audit(&self, session_id: &str) -> io::Result<Vec<MemoryAuditRecord>> {
        read_json_array(&self.audit_path(session_id))
    }

    pub fn list_episodic(&self, session_id: &str) -> io::Result<Vec<EpisodicMemoryEntry>> {
        read_json_array(&self.episodic_path(session_id))
    }

    pub fn get_rolling_summary(
        &self,
        session_id: &str,
        scope_ids: &[String],
        max_chars: usize,
    ) -> io::Result<String> {
        let allowed: HashSet<String> = scope_ids.iter().cloned().collect();
        let entries = self.list_episodic(session_id)?;
        let lines: Vec<String> = entries
            .into_iter()
            .filter(|entry| {
                entry
                    .scope_ids
                    .as_ref()
                    .is_none_or(|scopes| scopes.is_empty() || scopes.iter().any(|s| allowed.contains(s)))
            })
            .rev()
            .take(12)
            .collect::<Vec<_>>()
            .into_iter()
            .rev()
            .map(|entry| {
                format!(
                    "- {}{}: {}",
                    entry.entry_type,
                    entry
                        .node_id
                        .as_ref()
                        .map(|id| format!(" {id}"))
                        .unwrap_or_default(),
                    entry.summary
                )
            })
            .collect();
        Ok(truncate_text(&lines.join("\n"), max_chars))
    }

    pub fn record_packet_metadata(&self, metadata: &MemoryPacketMetadata) -> io::Result<()> {
        let session_id = metadata.session_id.clone();
        let mut packets = self.list_packet_metadata(&session_id)?;
        packets.retain(|packet| {
            packet
                .get("nodeId")
                .and_then(Value::as_str)
                .is_none_or(|id| id != metadata.node_id)
        });
        packets.push(serde_json::to_value(metadata).map_err(|err| {
            io::Error::new(io::ErrorKind::InvalidData, err.to_string())
        })?);
        let trimmed: Vec<_> = packets.into_iter().rev().take(200).rev().collect();
        self.write_json(
            &self.packet_path(&session_id),
            &serde_json::to_value(&trimmed)?,
        )
    }

    pub fn append_episodic(&self, entry: EpisodicMemoryEntry) -> io::Result<()> {
        let session_id = entry.session_id.clone();
        let mut entries = self.list_episodic(&session_id)?;
        entries.push(entry);
        let trimmed: Vec<_> = entries.into_iter().rev().take(500).rev().collect();
        self.write_json(
            &self.episodic_path(&session_id),
            &serde_json::to_value(&trimmed)?,
        )
    }

    pub fn list_packet_metadata(&self, session_id: &str) -> io::Result<Vec<Value>> {
        read_json_array(&self.packet_path(session_id))
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

    pub fn set_preference(
        &self,
        session_id: &str,
        key: &str,
        value: &str,
        source: &str,
        lifetime: &str,
    ) -> io::Result<MemoryScopePatchResult> {
        let safe_key = sanitize_id(key)
            .map_err(|err| io::Error::new(io::ErrorKind::InvalidInput, err.to_string()))?;
        if safe_key.is_empty() || value.trim().is_empty() {
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "Preference key and value are required.",
            ));
        }
        let existing = self.read_scope(session_id, "project-preferences")?;
        let result = self.patch_scope(MemoryScopePatchRequest {
            session_id: session_id.to_string(),
            scope_id: "project-preferences".into(),
            actor: "user".into(),
            expected_version: existing.as_ref().map(|doc| doc.version).unwrap_or(0),
            allowed_scopes: vec!["project-preferences".into()],
            writes: vec!["preferences".into()],
            patch: json!({
                safe_key: {
                    "value": value.trim(),
                    "source": source,
                    "updatedAt": iso_now(),
                }
            }),
            lifetime: Some(lifetime.to_string()),
        })?;
        if !result.accepted {
            return Err(io::Error::other(result.reason));
        }
        Ok(result)
    }

    pub fn delete_preference(
        &self,
        session_id: &str,
        key: &str,
    ) -> io::Result<MemoryScopePatchResult> {
        let safe_key = sanitize_id(key)
            .map_err(|err| io::Error::new(io::ErrorKind::InvalidInput, err.to_string()))?;
        if safe_key.is_empty() {
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "Preference key is required.",
            ));
        }
        let existing = self.read_scope(session_id, "project-preferences")?;
        let result = self.patch_scope(MemoryScopePatchRequest {
            session_id: session_id.to_string(),
            scope_id: "project-preferences".into(),
            actor: "user".into(),
            expected_version: existing.as_ref().map(|doc| doc.version).unwrap_or(0),
            allowed_scopes: vec!["project-preferences".into()],
            writes: vec!["preferences".into()],
            patch: json!({ safe_key: null }),
            lifetime: existing.as_ref().map(|doc| doc.lifetime.clone()),
        })?;
        if !result.accepted {
            return Err(io::Error::other(result.reason));
        }
        Ok(result)
    }

    fn authorize(&self, request: &MemoryScopePatchRequest) -> Option<String> {
        if !request.allowed_scopes.contains(&request.scope_id) {
            return Some("memory scope ACL denied".into());
        }
        if request.writes.is_empty() {
            return Some("memory writes not allowed by context policy".into());
        }
        None
    }

    fn audit_and_result(
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

    fn write_json(&self, path: &Path, value: &Value) -> io::Result<()> {
        write_json_atomic(path, value)
    }

    fn scope_path_for_lifetime(&self, session_id: &str, scope_id: &str, lifetime: &str) -> PathBuf {
        let safe_scope = sanitize_id(scope_id).unwrap_or_else(|_| scope_id.to_string());
        match lifetime {
            "project" => self
                .base_dir
                .join("project")
                .join("scopes")
                .join(format!("{safe_scope}.json")),
            "permanent" => self
                .base_dir
                .join("permanent")
                .join("scopes")
                .join(format!("{safe_scope}.json")),
            _ => self
                .session_dir(session_id)
                .join("scopes")
                .join(format!("{safe_scope}.json")),
        }
    }

    fn scope_read_paths(&self, session_id: &str, scope_id: &str) -> Vec<PathBuf> {
        [
            self.scope_path_for_lifetime(session_id, scope_id, "session"),
            self.scope_path_for_lifetime(session_id, scope_id, "project"),
            self.scope_path_for_lifetime(session_id, scope_id, "permanent"),
        ]
        .into_iter()
        .collect()
    }

    fn scope_list_dirs(&self, session_id: &str) -> Vec<PathBuf> {
        vec![
            self.session_dir(session_id).join("scopes"),
            self.base_dir.join("project").join("scopes"),
            self.base_dir.join("permanent").join("scopes"),
        ]
    }

    fn read_scope_dir(&self, dir: &Path) -> io::Result<Vec<MemoryScopeDocument>> {
        let entries = match fs::read_dir(dir) {
            Ok(entries) => entries,
            Err(err) if err.kind() == io::ErrorKind::NotFound => return Ok(Vec::new()),
            Err(err) => return Err(err),
        };
        let mut documents = Vec::new();
        for entry in entries.flatten() {
            let name = entry.file_name().to_string_lossy().to_string();
            if !name.ends_with(".json") {
                continue;
            }
            let raw = fs::read_to_string(entry.path())?;
            documents.push(
                serde_json::from_str(&raw)
                    .map_err(|err| io::Error::new(io::ErrorKind::InvalidData, err.to_string()))?,
            );
        }
        Ok(documents)
    }

    fn episodic_path(&self, session_id: &str) -> PathBuf {
        self.session_dir(session_id).join("episodic.json")
    }

    fn audit_path(&self, session_id: &str) -> PathBuf {
        self.session_dir(session_id).join("audit.json")
    }

    fn packet_path(&self, session_id: &str) -> PathBuf {
        self.session_dir(session_id).join("packets.json")
    }

    fn session_dir(&self, session_id: &str) -> PathBuf {
        let safe = sanitize_id(session_id).unwrap_or_else(|_| session_id.to_string());
        self.base_dir.join(safe)
    }
}

fn apply_patch(existing: Value, patch: Value) -> Value {
    let mut next = match existing {
        Value::Object(map) => map,
        _ => serde_json::Map::new(),
    };
    if let Value::Object(patch_map) = patch {
        for (key, value) in patch_map {
            if value.is_null() {
                next.remove(&key);
            } else {
                next.insert(key, value);
            }
        }
    }
    Value::Object(next)
}

fn truncate_text(text: &str, max_chars: usize) -> String {
    if text.len() <= max_chars {
        return text.to_string();
    }
    let keep = max_chars.saturating_sub(15);
    format!("{}\n[truncated]", text.chars().take(keep).collect::<String>().trim_end())
}

fn iso_now() -> String {
    time::OffsetDateTime::now_utc()
        .format(&time::format_description::well_known::Rfc3339)
        .unwrap_or_else(|_| "1970-01-01T00:00:00Z".to_string())
}

fn unique_suffix() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    format!("{nanos}")
}

#[cfg(test)]
#[path = "../../tests/persistence/memory_store.rs"]
mod memory_store_tests;
