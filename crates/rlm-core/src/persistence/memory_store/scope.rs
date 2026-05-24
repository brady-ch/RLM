use std::collections::HashMap;
use std::fs;
use std::io;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

use super::super::util::sanitize_id;
use super::{iso_now, unique_suffix, EpisodicMemoryEntry, FileMemoryStore};

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

impl FileMemoryStore {
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
    ) -> io::Result<super::MemoryScopePatchResult> {
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

    pub fn set_preference(
        &self,
        session_id: &str,
        key: &str,
        value: &str,
        source: &str,
        lifetime: &str,
    ) -> io::Result<super::MemoryScopePatchResult> {
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
    ) -> io::Result<super::MemoryScopePatchResult> {
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

    pub(super) fn scope_path_for_lifetime(
        &self,
        session_id: &str,
        scope_id: &str,
        lifetime: &str,
    ) -> PathBuf {
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
