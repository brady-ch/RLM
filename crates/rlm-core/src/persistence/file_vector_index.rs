use std::fs;
use std::io;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

use super::util::write_json_atomic;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct VectorIndexRecord {
    pub id: String,
    pub session_id: String,
    pub scope_id: String,
    pub source: VectorRecordSource,
    pub text: String,
    pub embedding: Vec<f32>,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum VectorRecordSource {
    Scope,
    Episodic,
    Artifact,
}

pub struct FileVectorIndex {
    path: PathBuf,
    write_counter: u64,
}

impl FileVectorIndex {
    pub fn new(path: PathBuf) -> Self {
        Self {
            path,
            write_counter: 0,
        }
    }

    pub fn path(&self) -> &Path {
        &self.path
    }

    pub fn read(&self) -> io::Result<Vec<VectorIndexRecord>> {
        match fs::read_to_string(&self.path) {
            Ok(raw) => serde_json::from_str(&raw)
                .map_err(|err| io::Error::new(io::ErrorKind::InvalidData, err.to_string())),
            Err(err) if err.kind() == io::ErrorKind::NotFound => Ok(Vec::new()),
            Err(err) => Err(err),
        }
    }

    pub fn replace(&mut self, records: &[VectorIndexRecord]) -> io::Result<()> {
        if let Some(parent) = self.path.parent() {
            fs::create_dir_all(parent)?;
        }
        self.write_counter += 1;
        let temp = self
            .path
            .with_extension(format!("{}.tmp", self.write_counter));
        write_json_atomic(&temp, &serde_json::to_value(records)?)?;
        fs::rename(temp, &self.path)?;
        Ok(())
    }

    pub fn merge_session_records(
        &mut self,
        session_id: &str,
        records: &[VectorIndexRecord],
    ) -> io::Result<()> {
        let existing = self.read()?;
        let mut others: Vec<_> = existing
            .into_iter()
            .filter(|record| record.session_id != session_id)
            .collect();
        others.extend(records.iter().cloned().map(|mut record| {
            record.session_id = session_id.to_string();
            record
        }));
        self.replace(&others)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    fn temp_path(name: &str) -> PathBuf {
        let path =
            std::env::temp_dir().join(format!("rlm-vector-json-{name}-{}", std::process::id()));
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
}
