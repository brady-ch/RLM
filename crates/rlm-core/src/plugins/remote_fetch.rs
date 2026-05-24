use std::path::{Path, PathBuf};

use flate2::read::GzDecoder;
use tar::Archive;

pub const MAX_ARCHIVE_DOWNLOAD_BYTES: u64 = 50 * 1024 * 1024;
pub const MAX_ARCHIVE_EXTRACT_BYTES: u64 = 100 * 1024 * 1024;

pub fn is_remote_install_source(source: &str) -> bool {
    classify_remote_install_source(source).is_some()
}

pub fn classify_remote_install_source(source: &str) -> Option<&'static str> {
    let trimmed = source.trim();
    if trimmed.starts_with("git:") {
        return Some("git");
    }
    if trimmed.starts_with("https://")
        && (trimmed.ends_with(".tar.gz") || trimmed.ends_with(".tgz"))
    {
        return Some("https-archive");
    }
    None
}

pub fn is_unsafe_archive_entry_path(entry_path: &str, extract_root: &Path) -> bool {
    let normalized = entry_path.replace('\\', "/");
    if normalized.starts_with('/') || normalized.contains(':') {
        return true;
    }
    if normalized.split('/').any(|segment| segment == "..") {
        return true;
    }
    let resolved = extract_root.join(normalized);
    let resolved = match resolved.canonicalize() {
        Ok(path) => path,
        Err(_) => resolved,
    };
    let root = match extract_root.canonicalize() {
        Ok(path) => path,
        Err(_) => extract_root.to_path_buf(),
    };
    !resolved.starts_with(&root)
}

pub struct RemoteFetchStaging {
    pub path: PathBuf,
    _temp: tempfile::TempDir,
}

pub async fn fetch_remote_plugin_to_staging(
    source: &str,
    client: &reqwest::Client,
) -> Result<RemoteFetchStaging, String> {
    let kind = classify_remote_install_source(source)
        .ok_or_else(|| {
            "Unsupported remote source. Use https://…/archive.tar.gz or git:https://github.com/org/repo.git"
                .to_string()
        })?;
    let staging_dir = tempfile::tempdir().map_err(|err| err.to_string())?;
    let staging_path = staging_dir.path().to_path_buf();
    match kind {
        "https-archive" => {
            fetch_and_extract_archive(source.trim(), &staging_path, client).await?;
        }
        "git" => {
            let repo_url = source.trim().strip_prefix("git:").unwrap_or(source);
            fetch_git_repository(repo_url, &staging_path)?;
        }
        _ => return Err("Unsupported remote source kind.".into()),
    }
    Ok(RemoteFetchStaging {
        path: staging_path,
        _temp: staging_dir,
    })
}

async fn fetch_and_extract_archive(
    url: &str,
    extract_root: &Path,
    client: &reqwest::Client,
) -> Result<(), String> {
    let response = client
        .get(url)
        .send()
        .await
        .map_err(|err| err.to_string())?;
    if !response.status().is_success() {
        return Err(format!(
            "Archive download failed with HTTP {}.",
            response.status()
        ));
    }
    let content_length = response.content_length().unwrap_or(0);
    if content_length > MAX_ARCHIVE_DOWNLOAD_BYTES {
        return Err(format!(
            "Archive exceeds maximum download size ({MAX_ARCHIVE_DOWNLOAD_BYTES} bytes)."
        ));
    }
    let bytes = response.bytes().await.map_err(|err| err.to_string())?;
    if bytes.len() as u64 > MAX_ARCHIVE_DOWNLOAD_BYTES {
        return Err(format!(
            "Archive exceeds maximum download size ({MAX_ARCHIVE_DOWNLOAD_BYTES} bytes)."
        ));
    }
    extract_tar_gz(&bytes, extract_root)
}

fn extract_tar_gz(bytes: &[u8], extract_root: &Path) -> Result<(), String> {
    std::fs::create_dir_all(extract_root).map_err(|err| err.to_string())?;
    let decoder = GzDecoder::new(bytes);
    let mut archive = Archive::new(decoder);
    let mut extracted_bytes: u64 = 0;
    for entry in archive.entries().map_err(|err| err.to_string())? {
        let mut entry = entry.map_err(|err| err.to_string())?;
        let path = entry.path().map_err(|err| err.to_string())?;
        let path_str = path.to_string_lossy();
        if is_unsafe_archive_entry_path(&path_str, extract_root) {
            return Err(format!("Unsafe archive entry path rejected: {path_str}"));
        }
        let size = entry.size();
        extracted_bytes = extracted_bytes.saturating_add(size);
        if extracted_bytes > MAX_ARCHIVE_EXTRACT_BYTES {
            return Err(format!(
                "Archive exceeds maximum extract size ({MAX_ARCHIVE_EXTRACT_BYTES} bytes)."
            ));
        }
        entry
            .unpack_in(extract_root)
            .map_err(|err| err.to_string())?;
    }
    Ok(())
}

fn fetch_git_repository(url: &str, target_dir: &Path) -> Result<(), String> {
    let status = std::process::Command::new("git")
        .args([
            "clone",
            "--depth",
            "1",
            url,
            target_dir.to_str().unwrap_or("."),
        ])
        .status()
        .map_err(|err| format!("git clone failed: {err}"))?;
    if !status.success() {
        return Err(format!("git clone failed for {url}"));
    }
    Ok(())
}

pub fn resolve_plugin_layout(source_path: &Path) -> Result<(PathBuf, PathBuf), String> {
    if source_path.join("rlm.plugin.json").is_file() {
        let register = find_register_entry(source_path)?;
        return Ok((source_path.to_path_buf(), register));
    }
    let mut entries = std::fs::read_dir(source_path).map_err(|err| err.to_string())?;
    while let Some(entry) = entries.next().transpose().map_err(|err| err.to_string())? {
        let path = entry.path();
        if path.is_dir() && path.join("rlm.plugin.json").is_file() {
            let register = find_register_entry(&path)?;
            return Ok((path, register));
        }
    }
    Err(format!(
        "No rlm.plugin.json found under {}",
        source_path.display()
    ))
}

fn find_register_entry(root: &Path) -> Result<PathBuf, String> {
    for candidate in [
        "register.rs",
        "register.ts",
        "register.js",
        "register.mjs",
        "index.ts",
        "index.js",
    ] {
        let path = root.join(candidate);
        if path.is_file() {
            return Ok(path);
        }
    }
    Ok(root.join("register.rs"))
}

#[cfg(test)]
#[path = "../../tests/plugins/remote_fetch.rs"]
mod remote_fetch_tests;
