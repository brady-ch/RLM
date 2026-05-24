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
#[path = "../../tests/persistence/file_vector_index.rs"]
mod file_vector_index_tests;
