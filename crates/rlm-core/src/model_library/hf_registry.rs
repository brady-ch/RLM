use std::fs;
use std::io;
use std::path::{Path, PathBuf};
use std::time::Duration;

use reqwest::Client;
use serde::{Deserialize, Serialize};
use thiserror::Error;

pub const MAX_HF_DOWNLOAD_BYTES: u64 = 50 * 1024 * 1024;

#[derive(Debug, Error)]
pub enum HfDownloadError {
    #[error("Hugging Face repo id is required")]
    MissingRepoId,
    #[error("Hugging Face list files failed: HTTP {status}")]
    ListHttp { status: u16 },
    #[error("No compatible GGUF artifact found in repository")]
    NoGgufArtifact,
    #[error("Download failed: HTTP {status}")]
    DownloadHttp { status: u16 },
    #[error("Download exceeds max size ({MAX_HF_DOWNLOAD_BYTES} bytes)")]
    TooLarge,
    #[error("Unsafe artifact path rejected: {path}")]
    UnsafePath { path: String },
    #[error("Registry write failed: {0}")]
    Io(#[from] io::Error),
    #[error("request failed: {0}")]
    Request(#[from] reqwest::Error),
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct RegistryRecord {
    pub id: String,
    pub repo_id: String,
    pub file_name: String,
    pub path: String,
    pub source: String,
    pub size_bytes: u64,
    pub downloaded_at: String,
}

#[derive(Clone)]
pub struct HfRegistry {
    client: Client,
    registry_dir: PathBuf,
}

impl HfRegistry {
    pub fn new(registry_dir: PathBuf) -> Self {
        let client = Client::builder()
            .timeout(Duration::from_secs(120))
            .build()
            .unwrap_or_else(|_| Client::new());
        Self {
            client,
            registry_dir,
        }
    }

    pub fn registry_dir(&self) -> &Path {
        &self.registry_dir
    }

    pub fn list_records(&self) -> io::Result<Vec<RegistryRecord>> {
        let manifest = self.manifest_path();
        if !manifest.is_file() {
            return Ok(Vec::new());
        }
        let raw = fs::read_to_string(manifest)?;
        serde_json::from_str(&raw).map_err(|err| io::Error::new(io::ErrorKind::InvalidData, err))
    }

    pub async fn search_models(&self, query: &str) -> Result<Vec<HfSearchHit>, HfDownloadError> {
        let normalized = query.trim();
        if normalized.is_empty() {
            return Ok(Vec::new());
        }
        let url = format!(
            "https://huggingface.co/api/models?search={}&limit=10",
            urlencoding_encode(normalized)
        );
        let response = self.client.get(url).send().await?;
        if !response.status().is_success() {
            return Err(HfDownloadError::ListHttp {
                status: response.status().as_u16(),
            });
        }
        let payload: Vec<HfSearchHit> = response.json().await?;
        Ok(payload)
    }

    pub async fn download_gguf(
        &self,
        repo_id: &str,
        preferred_file: Option<&str>,
    ) -> Result<RegistryRecord, HfDownloadError> {
        let repo_id = repo_id.trim();
        if repo_id.is_empty() {
            return Err(HfDownloadError::MissingRepoId);
        }

        let files = self.list_repo_files(repo_id).await?;
        let selected = select_gguf_file(&files, preferred_file)?;
        validate_safe_filename(&selected)?;

        fs::create_dir_all(&self.registry_dir)?;
        let artifact_path = self.registry_dir.join(&selected);
        if let Some(parent) = artifact_path.parent() {
            fs::create_dir_all(parent)?;
        }

        let download_url = format!("https://huggingface.co/{repo_id}/resolve/main/{selected}");
        let mut response = self.client.get(download_url).send().await?;
        if !response.status().is_success() {
            return Err(HfDownloadError::DownloadHttp {
                status: response.status().as_u16(),
            });
        }

        let mut downloaded = 0u64;
        let mut file = fs::File::create(&artifact_path)?;
        while let Some(chunk) = response.chunk().await? {
            downloaded += chunk.len() as u64;
            if downloaded > MAX_HF_DOWNLOAD_BYTES {
                drop(file);
                let _ = fs::remove_file(&artifact_path);
                return Err(HfDownloadError::TooLarge);
            }
            use std::io::Write;
            file.write_all(&chunk)?;
        }

        let record = RegistryRecord {
            id: format!("{repo_id}:{selected}"),
            repo_id: repo_id.to_string(),
            file_name: selected.clone(),
            path: artifact_path.to_string_lossy().to_string(),
            source: "huggingface".into(),
            size_bytes: downloaded,
            downloaded_at: time::OffsetDateTime::now_utc()
                .format(&time::format_description::well_known::Rfc3339)
                .unwrap_or_else(|_| "unknown".into()),
        };
        self.append_record(record.clone())?;
        Ok(record)
    }

    async fn list_repo_files(&self, repo_id: &str) -> Result<Vec<String>, HfDownloadError> {
        let url = format!("https://huggingface.co/api/models/{repo_id}/tree/main");
        let response = self.client.get(url).send().await?;
        if !response.status().is_success() {
            return Err(HfDownloadError::ListHttp {
                status: response.status().as_u16(),
            });
        }
        let payload: Vec<HfTreeEntry> = response.json().await?;
        Ok(payload
            .into_iter()
            .filter_map(|entry| entry.path.filter(|path| path.ends_with(".gguf")))
            .collect())
    }

    fn manifest_path(&self) -> PathBuf {
        self.registry_dir.join("manifest.json")
    }

    fn append_record(&self, record: RegistryRecord) -> io::Result<()> {
        let mut records = self.list_records()?;
        records.retain(|existing| existing.id != record.id);
        records.push(record);
        fs::write(
            self.manifest_path(),
            serde_json::to_string_pretty(&records)?,
        )
    }
}

#[derive(Debug, Clone, Deserialize)]
pub struct HfSearchHit {
    #[serde(rename = "modelId")]
    pub model_id: Option<String>,
    pub id: Option<String>,
    pub tags: Option<Vec<String>>,
}

#[derive(Debug, Deserialize)]
struct HfTreeEntry {
    path: Option<String>,
}

fn select_gguf_file(files: &[String], preferred: Option<&str>) -> Result<String, HfDownloadError> {
    if let Some(preferred) = preferred.filter(|value| !value.is_empty()) {
        if files.iter().any(|file| file == preferred) {
            return Ok(preferred.to_string());
        }
    }
    files
        .first()
        .cloned()
        .ok_or(HfDownloadError::NoGgufArtifact)
}

fn validate_safe_filename(path: &str) -> Result<(), HfDownloadError> {
    if path.contains("..") || path.starts_with('/') || path.contains('\\') {
        return Err(HfDownloadError::UnsafePath {
            path: path.to_string(),
        });
    }
    Ok(())
}

fn urlencoding_encode(input: &str) -> String {
    input
        .bytes()
        .map(|byte| match byte {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                (byte as char).to_string()
            }
            _ => format!("%{byte:02X}"),
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_unsafe_gguf_paths() {
        assert!(validate_safe_filename("../evil.gguf").is_err());
        assert!(validate_safe_filename("/tmp/evil.gguf").is_err());
        assert!(validate_safe_filename("model.gguf").is_ok());
    }

    #[test]
    fn selects_preferred_gguf_when_present() {
        let files = vec!["a.gguf".into(), "b.gguf".into()];
        let selected = select_gguf_file(&files, Some("b.gguf")).expect("select");
        assert_eq!(selected, "b.gguf");
    }
}
