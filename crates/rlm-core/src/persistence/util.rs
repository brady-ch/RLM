use std::fs;
use std::io;
use std::path::{Path, PathBuf};

use serde_json::Value;

/// Sanitize session/memory identifiers — mirrors TypeScript `sanitizeSessionId` / `safe`.
pub fn sanitize_id(id: &str) -> Result<String, String> {
    let safe: String = id
        .trim()
        .chars()
        .map(|ch| {
            if ch.is_ascii_alphanumeric() || ch == '.' || ch == '_' || ch == '-' {
                ch
            } else {
                '-'
            }
        })
        .collect();
    let collapsed = collapse_dashes(&safe);
    if collapsed.is_empty() || collapsed == "." || collapsed == ".." {
        return Err("identifiers must contain at least one safe character.".into());
    }
    Ok(collapsed)
}

fn collapse_dashes(input: &str) -> String {
    let mut out = String::new();
    let mut prev_dash = false;
    for ch in input.chars() {
        if ch == '-' {
            if !prev_dash {
                out.push('-');
            }
            prev_dash = true;
        } else {
            out.push(ch);
            prev_dash = false;
        }
    }
    out.trim_matches('-').to_string()
}

pub fn write_json_atomic(path: &Path, value: &Value) -> io::Result<()> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    let serialized = serde_json::to_string_pretty(value)
        .map_err(|err| io::Error::new(io::ErrorKind::InvalidData, err.to_string()))?;
    let temp = temp_path(path);
    fs::write(&temp, format!("{serialized}\n"))?;
    fs::rename(temp, path)?;
    Ok(())
}

fn temp_path(path: &Path) -> PathBuf {
    let pid = std::process::id();
    path.with_extension(format!(
        "{}.{}.tmp",
        path.extension()
            .and_then(|ext| ext.to_str())
            .unwrap_or("json"),
        pid
    ))
}

pub fn read_json_file(path: &Path) -> io::Result<Value> {
    let raw = fs::read_to_string(path)?;
    serde_json::from_str(&raw).map_err(|err| io::Error::new(io::ErrorKind::InvalidData, err))
}

pub fn read_json_array<T: serde::de::DeserializeOwned>(path: &Path) -> io::Result<Vec<T>> {
    match fs::read_to_string(path) {
        Ok(raw) => serde_json::from_str(&raw)
            .map_err(|err| io::Error::new(io::ErrorKind::InvalidData, err.to_string())),
        Err(err) if err.kind() == io::ErrorKind::NotFound => Ok(Vec::new()),
        Err(err) => Err(err),
    }
}

#[cfg(test)]
#[path = "../../tests/persistence/util.rs"]
mod util_tests;
