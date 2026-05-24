use std::fs;
use std::io;
use std::path::PathBuf;

use super::super::util::write_json_atomic;

use super::FileRunStateStore;
use super::PersistedRunState;

impl FileRunStateStore {
    pub(super) fn read(&self, run_id: &str) -> io::Result<Option<PersistedRunState>> {
        match fs::read_to_string(self.file_path(run_id)) {
            Ok(raw) => serde_json::from_str(&raw)
                .map(Some)
                .map_err(|err| io::Error::new(io::ErrorKind::InvalidData, err.to_string())),
            Err(err) if err.kind() == io::ErrorKind::NotFound => Ok(None),
            Err(err) => Err(err),
        }
    }

    pub(super) fn write(&self, run_id: &str, state: &PersistedRunState) -> io::Result<()> {
        write_json_atomic(
            &self.file_path(run_id),
            &serde_json::to_value(state)
                .map_err(|err| io::Error::new(io::ErrorKind::InvalidData, err.to_string()))?,
        )
    }

    pub(super) fn file_path(&self, run_id: &str) -> PathBuf {
        self.base_dir.join(format!("{run_id}.json"))
    }
}
