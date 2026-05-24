use std::path::PathBuf;
use std::sync::{Arc, Mutex};

use serde::{Deserialize, Serialize};
use tokio::sync::Mutex as AsyncMutex;

use crate::adapters::{EmbeddingError, OllamaEmbeddingModel};
use crate::application::execution::ProcessShutdown;
use crate::persistence::ann_vector_index::{AnnVectorIndex, RetrievalResult, RetrievalStatus};
use crate::persistence::file_vector_index::{VectorIndexRecord, VectorRecordSource};
use crate::persistence::FileMemoryStore;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VectorIndexStatus {
    pub status: String,
    pub provider: Option<String>,
    pub record_count: usize,
    pub rebuild_needed: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reason: Option<String>,
}

pub struct SemanticMemoryIndex {
    session_id: String,
    memory_dir: PathBuf,
    store: FileMemoryStore,
    embeddings: OllamaEmbeddingModel,
    ann: Arc<AsyncMutex<AnnVectorIndex>>,
    rebuild_pending: Arc<Mutex<bool>>,
    lifecycle: ProcessShutdown,
}

impl SemanticMemoryIndex {
    pub fn new(
        session_id: impl Into<String>,
        memory_dir: PathBuf,
        embeddings: OllamaEmbeddingModel,
        lifecycle: ProcessShutdown,
    ) -> Self {
        let session_id = session_id.into();
        let memory_dir = memory_dir.clone();
        Self {
            store: FileMemoryStore::new(memory_dir.clone()),
            session_id,
            memory_dir: memory_dir.clone(),
            embeddings,
            ann: Arc::new(AsyncMutex::new(AnnVectorIndex::new(memory_dir))),
            rebuild_pending: Arc::new(Mutex::new(false)),
            lifecycle,
        }
    }

    pub fn session_id(&self) -> &str {
        &self.session_id
    }

    pub async fn release_memory(&self) {
        let mut ann = self.ann.lock().await;
        ann.release_in_memory();
    }

    pub fn memory_dir(&self) -> &PathBuf {
        &self.memory_dir
    }

    pub fn store(&self) -> &FileMemoryStore {
        &self.store
    }

    pub fn ann(&self) -> Arc<AsyncMutex<AnnVectorIndex>> {
        Arc::clone(&self.ann)
    }

    pub fn enqueue_rebuild(&self) {
        if self.lifecycle.is_shutdown() {
            return;
        }
        let mut pending = self
            .rebuild_pending
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        if *pending {
            return;
        }
        *pending = true;

        let session_id = self.session_id.clone();
        let store = FileMemoryStore::new(self.memory_dir.clone());
        let embeddings = self.embeddings.clone();
        let ann = Arc::clone(&self.ann);
        let rebuild_pending = Arc::clone(&self.rebuild_pending);
        let lifecycle = self.lifecycle.clone();
        let lifecycle_task = lifecycle.clone();

        lifecycle.spawn(async move {
            if lifecycle_task.is_shutdown() {
                *rebuild_pending.lock().unwrap_or_else(|p| p.into_inner()) = false;
                return;
            }
            let result =
                rebuild_index(&session_id, &store, &embeddings, &ann, &lifecycle_task).await;
            if let Err(err) = result {
                tracing::warn!(error = %err, "vector index rebuild failed");
            }
            *rebuild_pending.lock().unwrap_or_else(|p| p.into_inner()) = false;
        });
    }

    pub async fn search(&self, query: &str, scope_ids: &[String], limit: usize) -> RetrievalResult {
        let mut ann = self.ann.lock().await;
        if let Err(err) = ann.ensure_loaded() {
            return RetrievalResult {
                hits: Vec::new(),
                status: RetrievalStatus::Degraded,
                reason: Some(err.to_string()),
            };
        }

        if ann.record_count() == 0 {
            self.enqueue_rebuild();
            return RetrievalResult {
                hits: Vec::new(),
                status: RetrievalStatus::Empty,
                reason: Some("index empty; rebuild scheduled asynchronously".into()),
            };
        }

        match self.embeddings.embed(query).await {
            Ok(query_embedding) => ann
                .search(&query_embedding, scope_ids, limit)
                .unwrap_or_else(|err| RetrievalResult {
                    hits: Vec::new(),
                    status: RetrievalStatus::Degraded,
                    reason: Some(err.to_string()),
                }),
            Err(err) => RetrievalResult {
                hits: Vec::new(),
                status: RetrievalStatus::Degraded,
                reason: Some(err.to_string()),
            },
        }
    }

    pub async fn status(&self) -> VectorIndexStatus {
        let mut ann = self.ann.lock().await;
        let record_count = match ann.ensure_loaded() {
            Ok(()) => ann.record_count(),
            Err(err) => {
                return VectorIndexStatus {
                    status: "degraded".into(),
                    provider: Some(self.embeddings.provider_label()),
                    record_count: 0,
                    rebuild_needed: true,
                    reason: Some(err.to_string()),
                };
            }
        };

        let session_records = ann.session_records(&self.session_id).unwrap_or_default();
        let episodic = self
            .store
            .list_episodic(&self.session_id)
            .unwrap_or_default();

        match self.embeddings.health_check().await {
            Ok(()) => {}
            Err(err) => {
                return VectorIndexStatus {
                    status: "degraded".into(),
                    provider: Some(self.embeddings.provider_label()),
                    record_count,
                    rebuild_needed: session_records.is_empty() && !episodic.is_empty(),
                    reason: Some(format!("Ollama embedding host unavailable: {err}")),
                };
            }
        }

        let status = if record_count == 0 {
            if episodic.is_empty() {
                "empty".to_string()
            } else {
                "not_indexed".to_string()
            }
        } else {
            "ready".to_string()
        };

        VectorIndexStatus {
            status,
            provider: Some(self.embeddings.provider_label()),
            record_count,
            rebuild_needed: session_records.is_empty() && !episodic.is_empty(),
            reason: None,
        }
    }
}

async fn rebuild_index(
    session_id: &str,
    store: &FileMemoryStore,
    embeddings: &OllamaEmbeddingModel,
    ann: &Arc<AsyncMutex<AnnVectorIndex>>,
    lifecycle: &ProcessShutdown,
) -> Result<Vec<VectorIndexRecord>, EmbeddingError> {
    if lifecycle.is_shutdown() {
        return Ok(Vec::new());
    }
    let mut records = Vec::new();
    let now = iso_now();

    for scope in store
        .list_scopes(session_id)
        .map_err(|err| EmbeddingError::Unavailable {
            message: err.to_string(),
        })?
    {
        if lifecycle.is_shutdown() {
            return Ok(Vec::new());
        }
        let text = format!("Scope {}: {}", scope.scope_id, scope.content);
        if text.len() > 20 {
            records.push(VectorIndexRecord {
                id: format!("scope:{}:{}", scope.lifetime, scope.scope_id),
                session_id: session_id.to_string(),
                scope_id: scope.scope_id.clone(),
                source: VectorRecordSource::Scope,
                text: text.clone(),
                embedding: embeddings.embed(&text).await?,
                updated_at: now.clone(),
            });
        }
    }

    for entry in store
        .list_episodic(session_id)
        .map_err(|err| EmbeddingError::Unavailable {
            message: err.to_string(),
        })?
    {
        if lifecycle.is_shutdown() {
            return Ok(Vec::new());
        }
        let Some(scope_id) = entry.scope_ids.as_ref().and_then(|ids| ids.first()) else {
            continue;
        };
        if entry.summary.trim().is_empty() {
            continue;
        }
        records.push(VectorIndexRecord {
            id: format!("episodic:{}", entry.id),
            session_id: session_id.to_string(),
            scope_id: scope_id.clone(),
            source: VectorRecordSource::Episodic,
            text: entry.summary.clone(),
            embedding: embeddings.embed(&entry.summary).await?,
            updated_at: now.clone(),
        });
    }

    let mut ann = ann.lock().await;
    ann.merge_session_records(session_id, &records)
        .map_err(|err| EmbeddingError::Unavailable {
            message: err.to_string(),
        })?;
    Ok(records)
}

fn iso_now() -> String {
    time::OffsetDateTime::now_utc()
        .format(&time::format_description::well_known::Rfc3339)
        .unwrap_or_else(|_| "1970-01-01T00:00:00Z".to_string())
}

#[cfg(test)]
#[path = "../../../tests/application/memory/semantic_memory_index.rs"]
mod semantic_memory_index_tests;
