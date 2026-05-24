use super::super::file_vector_index::{FileVectorIndex, VectorIndexRecord, VectorRecordSource};
use super::*;
use std::fs;

fn temp_dir(name: &str) -> PathBuf {
    let dir = std::env::temp_dir().join(format!("rlm-ann-{name}-{}", std::process::id()));
    let _ = fs::remove_dir_all(&dir);
    fs::create_dir_all(&dir).unwrap();
    dir
}

fn record(id: &str, scope: &str, embedding: Vec<f32>) -> VectorIndexRecord {
    VectorIndexRecord {
        id: id.into(),
        session_id: "run-1".into(),
        scope_id: scope.into(),
        source: VectorRecordSource::Scope,
        text: format!("text for {id}"),
        embedding,
        updated_at: "2026-05-22T00:00:00Z".into(),
    }
}

#[test]
fn search_filters_by_scope_and_returns_top_k() {
    let dir = temp_dir("scope-filter");
    let mut index = AnnVectorIndex::new(dir);
    index
        .rebuild_from_records(&[
            record("a", "notes", vec![1.0, 0.0]),
            record("b", "secrets", vec![0.99, 0.01]),
            record("c", "notes", vec![0.8, 0.2]),
        ])
        .unwrap();

    let result = index.search(&[1.0, 0.0], &["notes".into()], 2).unwrap();
    assert_eq!(result.status, RetrievalStatus::Ready);
    assert_eq!(result.hits.len(), 2);
    assert!(result.hits.iter().all(|hit| hit.scope_id == "notes"));
    assert_eq!(result.hits[0].id, "a");
}

#[test]
fn lazy_import_reads_existing_json_on_first_search() {
    let dir = temp_dir("lazy-import");
    let mut json = FileVectorIndex::new(dir.join("vector-index.json"));
    json.replace(&[record("saved", "notes", vec![1.0, 0.0])])
        .unwrap();

    let mut ann = AnnVectorIndex::new(dir);
    assert_eq!(ann.record_count(), 0);
    let result = ann.search(&[1.0, 0.0], &["notes".into()], 1).unwrap();
    assert_eq!(result.status, RetrievalStatus::Ready);
    assert_eq!(result.hits[0].id, "saved");
    assert_eq!(ann.record_count(), 1);
}
