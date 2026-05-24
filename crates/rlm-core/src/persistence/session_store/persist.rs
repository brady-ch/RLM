use std::fs;
use std::io;
use std::path::PathBuf;

use serde_json::{json, Value};

use super::{FileSessionStore, SavedSessionManifest, SectionEnvelope, SECTION_VERSION};

pub(crate) fn envelope(data: Value) -> Value {
    json!({ "version": SECTION_VERSION, "data": data })
}

pub(crate) fn iso_now() -> String {
    time::OffsetDateTime::now_utc()
        .format(&time::format_description::well_known::Rfc3339)
        .unwrap_or_else(|_| "1970-01-01T00:00:00Z".to_string())
}

pub(crate) fn chrono_placeholder() -> String {
    iso_now()
}

impl FileSessionStore {
    pub(super) fn read_section(
        &self,
        manifest: &SavedSessionManifest,
        name: &str,
    ) -> io::Result<Value> {
        let section = manifest
            .sections
            .get(name)
            .ok_or_else(|| io::Error::new(io::ErrorKind::NotFound, "missing section"))?;
        let path = self.session_dir(&manifest.id).join(&section.file);
        let parsed: SectionEnvelope = serde_json::from_str(&fs::read_to_string(path)?)?;
        Ok(parsed.data)
    }

    pub(super) fn safe_read_section(&self, manifest: &SavedSessionManifest, name: &str) -> Value {
        self.read_section(manifest, name).unwrap_or(Value::Null)
    }

    pub(super) fn read_manifest(&self, id: &str) -> io::Result<SavedSessionManifest> {
        let path = self.session_dir(id).join("manifest.json");
        let raw = fs::read_to_string(path)?;
        serde_json::from_str(&raw).map_err(|err| io::Error::new(io::ErrorKind::InvalidData, err))
    }

    pub(super) fn session_dir(&self, id: &str) -> PathBuf {
        self.base_dir.join(id)
    }
}
