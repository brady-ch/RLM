mod persist;
mod verify;

use std::collections::BTreeMap;
use std::fs;
use std::io;
use std::path::PathBuf;

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

use super::util::{sanitize_id, write_json_atomic};

use persist::{chrono_placeholder, envelope, iso_now};

const MANIFEST_VERSION: u32 = 1;
const SECTION_VERSION: u32 = 1;

const SECTION_FILES: [(&str, &str); 7] = [
    ("session", "session.json"),
    ("runState", "run-state.json"),
    ("artifacts", "artifacts.json"),
    ("memory", "memory.json"),
    ("preferences", "preferences.json"),
    ("vectorIndex", "vector-index.json"),
    ("graphWorkflowMetadata", "graph-workflow-metadata.json"),
];

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SectionManifest {
    file: String,
    version: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SavedSessionManifest {
    version: u32,
    id: String,
    name: String,
    created_at: String,
    updated_at: String,
    sections: BTreeMap<String, SectionManifest>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct SectionEnvelope {
    version: u32,
    data: Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SavedSessionSectionStatus {
    pub name: String,
    pub status: String,
    pub path: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub version: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reason: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SavedSessionVerification {
    pub status: String,
    pub sections: Vec<SavedSessionSectionStatus>,
    pub missing: Vec<String>,
    pub corrupt: Vec<CorruptSection>,
    pub unsafe_to_continue: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CorruptSection {
    pub section: String,
    pub reason: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SavedSessionSummary {
    pub id: String,
    pub name: String,
    pub created_at: String,
    pub updated_at: String,
    pub status: String,
    pub path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SavedSessionPayload {
    pub session: Value,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub run_state: Option<Value>,
    pub artifacts: Value,
    pub memory: Value,
    pub preferences: Value,
    pub vector_index: Value,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub graph_workflow_metadata: Option<Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SavedSessionRecord {
    #[serde(flatten)]
    pub summary: SavedSessionSummary,
    pub payload: SavedSessionPayload,
    pub verification: SavedSessionVerification,
}

#[derive(Debug, Clone)]
pub struct SaveSessionRequest {
    pub id: Option<String>,
    pub name: Option<String>,
    pub payload: SavedSessionPayload,
}

pub struct FileSessionStore {
    pub(super) base_dir: PathBuf,
}

impl FileSessionStore {
    pub fn new(base_dir: PathBuf) -> Self {
        Self { base_dir }
    }

    pub fn save(&self, request: SaveSessionRequest) -> io::Result<SavedSessionRecord> {
        let id = sanitize_id(
            request
                .id
                .as_deref()
                .unwrap_or(&format!("session-{}", chrono_placeholder())),
        )
        .map_err(|msg| io::Error::new(io::ErrorKind::InvalidInput, msg))?;
        let dir = self.session_dir(&id);
        fs::create_dir_all(&dir)?;
        let existing = self.read_manifest(&id).ok();
        let timestamp = iso_now();
        let name = request
            .name
            .as_deref()
            .map(str::trim)
            .filter(|n| !n.is_empty())
            .map(str::to_string)
            .or_else(|| existing.as_ref().map(|m| m.name.clone()))
            .unwrap_or_else(|| id.clone());

        let mut sections = BTreeMap::new();
        for (name, file) in SECTION_FILES {
            sections.insert(
                name.to_string(),
                SectionManifest {
                    file: file.to_string(),
                    version: SECTION_VERSION,
                },
            );
        }

        let manifest = SavedSessionManifest {
            version: MANIFEST_VERSION,
            id: id.clone(),
            name,
            created_at: existing
                .as_ref()
                .map(|m| m.created_at.clone())
                .unwrap_or_else(iso_now),
            updated_at: timestamp,
            sections,
        };

        write_json_atomic(
            &dir.join("session.json"),
            &envelope(request.payload.session),
        )?;
        write_json_atomic(
            &dir.join("run-state.json"),
            &envelope(request.payload.run_state.unwrap_or(Value::Null)),
        )?;
        write_json_atomic(
            &dir.join("artifacts.json"),
            &envelope(request.payload.artifacts),
        )?;
        write_json_atomic(&dir.join("memory.json"), &envelope(request.payload.memory))?;
        write_json_atomic(
            &dir.join("preferences.json"),
            &envelope(request.payload.preferences),
        )?;
        write_json_atomic(
            &dir.join("vector-index.json"),
            &envelope(request.payload.vector_index),
        )?;
        write_json_atomic(
            &dir.join("graph-workflow-metadata.json"),
            &envelope(
                request
                    .payload
                    .graph_workflow_metadata
                    .unwrap_or_else(|| json!({ "version": 1 })),
            ),
        )?;
        write_json_atomic(
            &dir.join("manifest.json"),
            &serde_json::to_value(&manifest)?,
        )?;

        self.load(&id)
    }

    pub fn list(&self) -> io::Result<Vec<SavedSessionSummary>> {
        let entries = match fs::read_dir(&self.base_dir) {
            Ok(entries) => entries,
            Err(err) if err.kind() == io::ErrorKind::NotFound => return Ok(Vec::new()),
            Err(err) => return Err(err),
        };

        let mut summaries = Vec::new();
        for entry in entries.flatten() {
            let id = entry.file_name().to_string_lossy().to_string();
            if self.read_manifest(&id).is_err() {
                continue;
            }
            if let Ok(record) = self.load(&id) {
                summaries.push(SavedSessionSummary {
                    id: record.summary.id,
                    name: record.summary.name,
                    created_at: record.summary.created_at,
                    updated_at: record.summary.updated_at,
                    status: record.summary.status,
                    path: record.summary.path,
                });
            }
        }

        summaries.sort_by(|a, b| b.updated_at.cmp(&a.updated_at));
        Ok(summaries)
    }

    pub fn load(&self, id: &str) -> io::Result<SavedSessionRecord> {
        let id = sanitize_id(id).map_err(|msg| io::Error::new(io::ErrorKind::InvalidInput, msg))?;
        let manifest = self.read_manifest(&id)?;
        let verification = self.verify_manifest(&manifest)?;
        let payload = SavedSessionPayload {
            session: self.safe_read_section(&manifest, "session"),
            run_state: Some(self.safe_read_section(&manifest, "runState")),
            artifacts: self.safe_read_section(&manifest, "artifacts"),
            memory: self.safe_read_section(&manifest, "memory"),
            preferences: self.safe_read_section(&manifest, "preferences"),
            vector_index: self.safe_read_section(&manifest, "vectorIndex"),
            graph_workflow_metadata: Some(
                self.safe_read_section(&manifest, "graphWorkflowMetadata"),
            ),
        };

        Ok(SavedSessionRecord {
            summary: SavedSessionSummary {
                id: manifest.id.clone(),
                name: manifest.name.clone(),
                created_at: manifest.created_at.clone(),
                updated_at: manifest.updated_at.clone(),
                status: verification.status.clone(),
                path: self.session_dir(&manifest.id).to_string_lossy().to_string(),
            },
            payload,
            verification,
        })
    }

    pub fn inspect(&self, id: &str) -> io::Result<SavedSessionVerification> {
        let id = sanitize_id(id).map_err(|msg| io::Error::new(io::ErrorKind::InvalidInput, msg))?;
        let manifest = self.read_manifest(&id)?;
        self.verify_manifest(&manifest)
    }
}

#[cfg(test)]
#[path = "../../../tests/persistence/session_store.rs"]
mod session_store_tests;
