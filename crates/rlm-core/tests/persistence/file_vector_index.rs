use super::*;
use std::fs;

fn temp_path(name: &str) -> PathBuf {
    let path = std::env::temp_dir().join(format!("rlm-vector-json-{name}-{}", std::process::id()));
    let _ = fs::remove_file(&path);
    path
}

fn sample(id: &str, session_id: &str) -> VectorIndexRecord {
    VectorIndexRecord {
        id: id.into(),
        session_id: session_id.into(),
        scope_id: "notes".into(),
        source: VectorRecordSource::Scope,
        text: id.into(),
        embedding: vec![1.0, 0.0],
        updated_at: "2026-05-22T00:00:00Z".into(),
    }
}

#[test]
fn merge_session_records_preserves_other_sessions() {
    let path = temp_path("merge");
    let mut index = FileVectorIndex::new(path);
    index
        .replace(&[sample("a", "run-a"), sample("b", "run-b")])
        .unwrap();
    index
        .merge_session_records("run-a", &[sample("a2", "run-a")])
        .unwrap();
    let records = index.read().unwrap();
    assert_eq!(
        records.iter().filter(|r| r.session_id == "run-a").count(),
        1
    );
    assert_eq!(
        records.iter().filter(|r| r.session_id == "run-b").count(),
        1
    );
    assert_eq!(
        records.iter().find(|r| r.session_id == "run-a").unwrap().id,
        "a2"
    );
}
