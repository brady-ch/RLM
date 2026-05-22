use std::collections::HashMap;
use std::path::Path;

use sha2::{Digest, Sha256};

pub(crate) fn allowlist_key(abs_path: &Path) -> String {
    let mut hasher = Sha256::new();
    hasher.update(abs_path.display().to_string().as_bytes());
    format!("{:x}", hasher.finalize())
}

pub(crate) fn read_allowlist(path: &Path) -> Result<HashMap<String, String>, String> {
    if !path.exists() {
        return Ok(HashMap::new());
    }
    let raw = std::fs::read_to_string(path).map_err(|err| err.to_string())?;
    serde_json::from_str(&raw).map_err(|err| err.to_string())
}

pub(crate) fn write_allowlist(
    path: &Path,
    allowlist: &HashMap<String, String>,
) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|err| err.to_string())?;
    }
    let raw = serde_json::to_string_pretty(allowlist).map_err(|err| err.to_string())?;
    std::fs::write(path, format!("{raw}\n")).map_err(|err| err.to_string())
}

pub(crate) fn copy_dir_recursive(from: &Path, to: &Path) -> Result<(), String> {
    std::fs::create_dir_all(to).map_err(|err| err.to_string())?;
    for entry in std::fs::read_dir(from).map_err(|err| err.to_string())? {
        let entry = entry.map_err(|err| err.to_string())?;
        let target = to.join(entry.file_name());
        if entry.file_type().map_err(|err| err.to_string())?.is_dir() {
            copy_dir_recursive(&entry.path(), &target)?;
        } else {
            std::fs::copy(entry.path(), target).map_err(|err| err.to_string())?;
        }
    }
    Ok(())
}
