use std::collections::HashMap;
use std::fs;
use std::hash::{Hash, Hasher};
use std::io;
use std::path::{Path, PathBuf};

use serde::Serialize;
use usearch::{Index, IndexOptions, MetricKind, ScalarKind};

use super::file_vector_index::{FileVectorIndex, VectorIndexRecord};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RetrievalHit {
    pub id: String,
    pub source: String,
    pub scope_id: String,
    pub snippet: String,
    pub score: f32,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RetrievalStatus {
    Ready,
    Empty,
    Degraded,
}

#[derive(Debug, Clone)]
pub struct RetrievalResult {
    pub hits: Vec<RetrievalHit>,
    pub status: RetrievalStatus,
    pub reason: Option<String>,
}

struct RecordMeta {
    record: VectorIndexRecord,
}

pub struct AnnVectorIndex {
    json_index: FileVectorIndex,
    usearch_path: PathBuf,
    index: Option<Index>,
    metadata: HashMap<u64, RecordMeta>,
    dimensions: usize,
    loaded: bool,
}

impl Drop for AnnVectorIndex {
    fn drop(&mut self) {
        self.release_in_memory();
    }
}

impl AnnVectorIndex {
    pub fn new(memory_dir: PathBuf) -> Self {
        let json_path = memory_dir.join("vector-index.json");
        let usearch_path = memory_dir.join("vector.usearch");
        Self {
            json_index: FileVectorIndex::new(json_path),
            usearch_path,
            index: None,
            metadata: HashMap::new(),
            dimensions: 0,
            loaded: false,
        }
    }

    pub fn record_count(&self) -> usize {
        self.metadata.len()
    }

    /// Drop in-memory ANN state; on-disk JSON envelope is preserved.
    pub fn release_in_memory(&mut self) {
        self.index = None;
        self.metadata.clear();
        self.dimensions = 0;
        self.loaded = false;
    }

    pub fn ensure_loaded(&mut self) -> io::Result<()> {
        if self.loaded {
            return Ok(());
        }
        let records = self.json_index.read()?;
        self.rebuild_from_records(&records)?;
        self.loaded = true;
        Ok(())
    }

    pub fn rebuild_from_records(&mut self, records: &[VectorIndexRecord]) -> io::Result<()> {
        self.metadata.clear();
        self.index = None;
        self.dimensions = 0;

        let valid: Vec<&VectorIndexRecord> = records
            .iter()
            .filter(|record| !record.embedding.is_empty())
            .collect();
        if valid.is_empty() {
            self.persist_usearch()?;
            return Ok(());
        }

        self.dimensions = valid[0].embedding.len();
        let index = create_index(self.dimensions)?;
        index.reserve(valid.len()).map_err(usearch_error)?;
        self.index = Some(index);

        for record in valid {
            if record.embedding.len() != self.dimensions {
                continue;
            }
            let key = record_key(&record.id);
            if let Some(index) = self.index.as_ref() {
                index.add(key, &record.embedding).map_err(usearch_error)?;
            }
            self.metadata.insert(
                key,
                RecordMeta {
                    record: (*record).clone(),
                },
            );
        }
        self.persist_usearch()?;
        self.loaded = true;
        Ok(())
    }

    pub fn merge_session_records(
        &mut self,
        session_id: &str,
        records: &[VectorIndexRecord],
    ) -> io::Result<()> {
        self.json_index.merge_session_records(session_id, records)?;
        self.loaded = false;
        self.ensure_loaded()
    }

    pub fn json_index(&self) -> &FileVectorIndex {
        &self.json_index
    }

    pub fn memory_dir(&self) -> &Path {
        self.json_index
            .path()
            .parent()
            .unwrap_or_else(|| Path::new("."))
    }

    pub fn session_records(&self, session_id: &str) -> io::Result<Vec<VectorIndexRecord>> {
        Ok(self
            .json_index
            .read()?
            .into_iter()
            .filter(|record| record.session_id == session_id)
            .collect())
    }

    pub fn search(
        &mut self,
        query_embedding: &[f32],
        scope_ids: &[String],
        limit: usize,
    ) -> io::Result<RetrievalResult> {
        self.ensure_loaded()?;

        if self.metadata.is_empty() {
            return Ok(RetrievalResult {
                hits: Vec::new(),
                status: RetrievalStatus::Empty,
                reason: Some("index empty; rebuild scheduled asynchronously".into()),
            });
        }

        let allowed: std::collections::HashSet<_> = scope_ids.iter().cloned().collect();
        let eligible_count = self
            .metadata
            .values()
            .filter(|meta| allowed.contains(&meta.record.scope_id))
            .count();
        if eligible_count == 0 {
            return Ok(RetrievalResult {
                hits: Vec::new(),
                status: RetrievalStatus::Empty,
                reason: None,
            });
        }

        let Some(index) = self.index.as_ref() else {
            return Ok(RetrievalResult {
                hits: Vec::new(),
                status: RetrievalStatus::Degraded,
                reason: Some("ANN index unavailable".into()),
            });
        };

        if query_embedding.len() != self.dimensions {
            return Ok(RetrievalResult {
                hits: Vec::new(),
                status: RetrievalStatus::Degraded,
                reason: Some(format!(
                    "query embedding dimension mismatch: expected {}, got {}",
                    self.dimensions,
                    query_embedding.len()
                )),
            });
        }

        let fetch = (limit.max(1) * 4).min(self.metadata.len()).max(limit);
        let results = index
            .search(query_embedding, fetch)
            .map_err(usearch_error)?;

        let mut hits = Vec::new();
        for (key, distance) in results.keys.iter().zip(results.distances.iter()) {
            let Some(meta) = self.metadata.get(key) else {
                continue;
            };
            if !allowed.contains(&meta.record.scope_id) {
                continue;
            }
            hits.push(RetrievalHit {
                id: meta.record.id.clone(),
                source: source_label(&meta.record.source),
                scope_id: meta.record.scope_id.clone(),
                snippet: truncate(&meta.record.text, 220),
                score: 1.0 - distance,
            });
            if hits.len() >= limit {
                break;
            }
        }

        Ok(RetrievalResult {
            hits,
            status: RetrievalStatus::Ready,
            reason: None,
        })
    }

    fn persist_usearch(&self) -> io::Result<()> {
        let Some(index) = self.index.as_ref() else {
            if self.usearch_path.exists() {
                fs::remove_file(&self.usearch_path)?;
            }
            return Ok(());
        };
        if let Some(parent) = self.usearch_path.parent() {
            fs::create_dir_all(parent)?;
        }
        index
            .save(self.usearch_path.to_str().ok_or_else(|| {
                io::Error::new(io::ErrorKind::InvalidInput, "invalid usearch path")
            })?)
            .map_err(usearch_error)
    }
}

fn create_index(dimensions: usize) -> io::Result<Index> {
    let options = IndexOptions {
        dimensions,
        metric: MetricKind::Cos,
        quantization: ScalarKind::F32,
        ..Default::default()
    };
    Index::new(&options).map_err(usearch_error)
}

fn record_key(id: &str) -> u64 {
    let mut hasher = std::collections::hash_map::DefaultHasher::new();
    id.hash(&mut hasher);
    hasher.finish()
}

fn usearch_error(err: impl std::fmt::Display) -> io::Error {
    io::Error::other(err.to_string())
}

fn source_label(source: &super::file_vector_index::VectorRecordSource) -> String {
    match source {
        super::file_vector_index::VectorRecordSource::Scope => "scope".into(),
        super::file_vector_index::VectorRecordSource::Episodic => "episodic".into(),
        super::file_vector_index::VectorRecordSource::Artifact => "artifact".into(),
    }
}

fn truncate(text: &str, max_chars: usize) -> String {
    if text.chars().count() <= max_chars {
        return text.to_string();
    }
    let trimmed: String = text.chars().take(max_chars.saturating_sub(15)).collect();
    format!("{}\n[truncated]", trimmed.trim_end())
}

#[cfg(test)]
#[path = "../../tests/persistence/ann_vector_index.rs"]
mod ann_vector_index_tests;
