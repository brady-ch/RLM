use super::*;
use crate::application::execution::ProcessShutdown;
use crate::persistence::file_vector_index::{FileVectorIndex, VectorRecordSource};
use std::fs;

fn temp_dir(name: &str) -> PathBuf {
    let dir = std::env::temp_dir().join(format!("rlm-semantic-{name}-{}", std::process::id()));
    let _ = fs::remove_dir_all(&dir);
    fs::create_dir_all(&dir).unwrap();
    dir
}

#[tokio::test]
async fn search_on_empty_index_returns_immediately() {
    let dir = temp_dir("empty");
    let index = SemanticMemoryIndex::new(
        "run-async",
        dir,
        OllamaEmbeddingModel::default(),
        ProcessShutdown::default(),
    );
    let started = std::time::Instant::now();
    let result = index.search("hello", &["notes".into()], 4).await;
    assert!(started.elapsed().as_millis() < 500);
    assert_eq!(result.status, RetrievalStatus::Empty);
}

#[tokio::test]
async fn lazy_json_import_loads_records_for_status() {
    let dir = temp_dir("lazy");
    let mut json = FileVectorIndex::new(dir.join("vector-index.json"));
    json.replace(&[VectorIndexRecord {
        id: "scope:session:notes".into(),
        session_id: "run-1".into(),
        scope_id: "notes".into(),
        source: VectorRecordSource::Scope,
        text: "Scope notes".into(),
        embedding: vec![1.0, 0.0, 0.0],
        updated_at: "2026-05-22T00:00:00Z".into(),
    }])
    .unwrap();

    let index = SemanticMemoryIndex::new(
        "run-1",
        dir,
        OllamaEmbeddingModel::default(),
        ProcessShutdown::default(),
    );
    let status = index.status().await;
    assert_eq!(status.record_count, 1);
}
