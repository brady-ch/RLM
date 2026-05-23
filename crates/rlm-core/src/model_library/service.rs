use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;

use reqwest::Client;
use serde_json::Value;
use tokio::sync::Mutex;

use super::hf_registry::{HfDownloadError, HfRegistry, RegistryRecord};
use super::types::{
    ModelInstallJob, ModelLibraryEntry, ModelLibrarySearchResult, ModelLibrarySnapshot,
    CURATED_MODELS,
};
use crate::application::execution::ProcessShutdown;
use crate::application::memory::{
    available_model_ram_mb, estimate_model_ram_mb, model_ram_eligibility, ram_snapshot,
};

#[derive(Clone)]
pub struct ModelLibraryService {
    config: Arc<Mutex<Value>>,
    ollama_base_url: String,
    client: Client,
    jobs: Arc<Mutex<HashMap<String, ModelInstallJob>>>,
    hf_registry: HfRegistry,
    lifecycle: Option<ProcessShutdown>,
}

impl ModelLibraryService {
    pub fn new(
        project_root: std::path::PathBuf,
        config: Value,
        ollama_base_url: String,
        lifecycle: Option<ProcessShutdown>,
    ) -> Self {
        let registry_dir = project_root.join(".rlm").join("models").join("registry");
        Self {
            config: Arc::new(Mutex::new(config)),
            ollama_base_url,
            client: Client::builder()
                .timeout(Duration::from_secs(120))
                .build()
                .unwrap_or_else(|_| Client::new()),
            jobs: Arc::new(Mutex::new(HashMap::new())),
            hf_registry: HfRegistry::new(registry_dir),
            lifecycle,
        }
    }

    pub async fn config_snapshot(&self) -> Value {
        self.config.lock().await.clone()
    }

    pub async fn snapshot(&self) -> ModelLibrarySnapshot {
        let raw_installed = self.list_installed().await;
        let installed_ids: std::collections::HashSet<_> =
            raw_installed.iter().map(|entry| entry.id.clone()).collect();
        let config_snapshot = self.config_snapshot().await;
        let installed = raw_installed
            .into_iter()
            .map(|mut entry| {
                let model = entry.ollama_model.as_deref().unwrap_or(&entry.id);
                if let Some(estimate) = estimate_model_ram_mb(&config_snapshot, model) {
                    entry.estimated_ram_mb.get_or_insert(estimate);
                    let disabled_reason = model_ram_eligibility(
                        Some(estimate),
                        &ram_snapshot(&config_snapshot, 0),
                    )
                    .disabled_reason;
                    entry.disabled = Some(disabled_reason.is_some()).filter(|disabled| *disabled);
                    entry.disabled_reason = disabled_reason;
                }
                entry
            })
            .collect();
        let jobs = self.jobs.lock().await;
        let active_jobs: HashMap<_, _> = jobs
            .values()
            .map(|job| (job.model.clone(), job.clone()))
            .collect();
        drop(jobs);

        let curated = CURATED_MODELS
            .iter()
            .map(|(id, label, description, ram, tags)| {
                let ollama_model = (*id).to_string();
                let job = active_jobs.get(&ollama_model);
                let disabled_reason = model_ram_eligibility(
                    Some(*ram),
                    &ram_snapshot(&config_snapshot, 0),
                )
                .disabled_reason;
                let status = if installed_ids.contains(&ollama_model) {
                    "installed"
                } else if job.is_some_and(|job| job.status == "failed") {
                    "failed"
                } else if job.is_some_and(|job| job.status == "queued" || job.status == "running") {
                    "installing"
                } else {
                    "available"
                };
                ModelLibraryEntry {
                    id: ollama_model.clone(),
                    label: (*label).to_string(),
                    source: "curated".into(),
                    ollama_model: Some(ollama_model),
                    description: (*description).to_string(),
                    tags: tags.iter().map(|tag| (*tag).to_string()).collect(),
                    estimated_ram_mb: Some(*ram),
                    status: status.into(),
                    reason: job
                        .filter(|job| job.status == "failed")
                        .map(|job| job.message.clone()),
                    disabled: Some(disabled_reason.is_some()).filter(|disabled| *disabled),
                    disabled_reason,
                }
            })
            .collect();

        let tiers = self.tiers_snapshot().await;
        let jobs = self.jobs.lock().await.values().cloned().collect();

        ModelLibrarySnapshot {
            curated,
            installed,
            jobs,
            tiers,
        }
    }

    pub async fn search_huggingface(
        &self,
        query: &str,
    ) -> Result<ModelLibrarySearchResult, String> {
        let normalized = query.trim().to_string();
        if normalized.is_empty() {
            return Ok(ModelLibrarySearchResult {
                query: normalized,
                results: Vec::new(),
            });
        }

        let hits = self
            .hf_registry
            .search_models(&normalized)
            .await
            .map_err(|err| err.to_string())?;

        let registry_records = self
            .hf_registry
            .list_records()
            .unwrap_or_default()
            .into_iter()
            .map(|record| record.id)
            .collect::<std::collections::HashSet<_>>();

        let results = hits
            .into_iter()
            .map(|hit| {
                let id = hit
                    .model_id
                    .or(hit.id)
                    .unwrap_or_else(|| "unknown".to_string());
                let tags = hit.tags.unwrap_or_default();
                let gguf_compatible = tags
                    .iter()
                    .any(|tag| tag.to_ascii_lowercase().contains("gguf"));
                let installed = registry_records.contains(&id);
                ModelLibraryEntry {
                    id: id.clone(),
                    label: id.clone(),
                    source: "huggingface".into(),
                    ollama_model: None,
                    description: if gguf_compatible {
                        "Hugging Face GGUF-compatible result. Download stores validated artifacts in the local registry.".into()
                    } else {
                        "Unsupported for direct install; no compatible GGUF signal found.".into()
                    },
                    tags,
                    estimated_ram_mb: None,
                    status: if installed {
                        "installed".into()
                    } else if gguf_compatible {
                        "available".into()
                    } else {
                        "unsupported".into()
                    },
                    reason: if gguf_compatible {
                        None
                    } else {
                        Some("No compatible GGUF signal found.".into())
                    },
                    disabled: None,
                    disabled_reason: None,
                }
            })
            .collect();

        Ok(ModelLibrarySearchResult {
            query: normalized,
            results,
        })
    }

    pub async fn start_install(&self, model: &str) -> Result<ModelInstallJob, String> {
        let normalized = model.trim();
        if normalized.is_empty() {
            return Err("Model id is required.".into());
        }
        let allowed: std::collections::HashSet<_> = CURATED_MODELS
            .iter()
            .map(|(id, ..)| (*id).to_string())
            .collect();
        if !allowed.contains(normalized) {
            return Err(format!(
                "Model \"{normalized}\" is not a curated Ollama model."
            ));
        }
        let config = self.config.lock().await;
        if let (Some(estimate), Some(available)) = (
            estimate_model_ram_mb(&config, normalized),
            available_model_ram_mb(&config, 0),
        ) {
            if estimate > available {
                return Err(format!(
                    "Model \"{normalized}\" requires {estimate} MB but only {available} MB is available."
                ));
            }
        }
        drop(config);

        let mut jobs = self.jobs.lock().await;
        if let Some(existing) = jobs.values().find(|job| {
            job.model == normalized && (job.status == "queued" || job.status == "running")
        }) {
            return Ok(existing.clone());
        }

        let job = ModelInstallJob {
            id: format!("install-{}-{}", now_epoch_ms(), jobs.len() + 1),
            model: normalized.to_string(),
            status: "queued".into(),
            progress: 0.0,
            message: "queued".into(),
            started_at: now_rfc3339(),
            completed_at: None,
        };
        jobs.insert(job.id.clone(), job.clone());
        drop(jobs);

        let service = self.clone();
        let model_name = normalized.to_string();
        let install = async move {
            service.run_install(&model_name).await;
        };
        if let Some(lifecycle) = &self.lifecycle {
            lifecycle.spawn(install);
        } else {
            tokio::spawn(install);
        }

        Ok(job)
    }

    pub async fn download_hf_model(
        &self,
        repo_id: &str,
        file: Option<&str>,
    ) -> Result<RegistryRecord, HfDownloadError> {
        self.hf_registry.download_gguf(repo_id, file).await
    }

    pub async fn select_tier(
        &self,
        tier: &str,
        model: &str,
    ) -> Result<HashMap<String, String>, String> {
        let tier = tier.trim();
        let model = model.trim();
        if model.is_empty() {
            return Err("Model id is required.".into());
        }

        let mut config = self.config.lock().await;
        let estimate = estimate_model_ram_mb(&config, model);
        if let (Some(estimate), Some(available)) = (
            estimate_model_ram_mb(&config, model),
            available_model_ram_mb(&config, 0),
        ) {
            if estimate > available {
                return Err(format!(
                    "Model \"{model}\" requires {estimate} MB but only {available} MB is available."
                ));
            }
        }
        let tiers = config
            .pointer_mut("/models/tiers")
            .and_then(Value::as_object_mut)
            .ok_or_else(|| format!("Unknown model tier \"{tier}\"."))?;
        let tier_doc = tiers
            .get_mut(tier)
            .and_then(Value::as_object_mut)
            .ok_or_else(|| format!("Unknown model tier \"{tier}\"."))?;
        tier_doc.insert("name".into(), Value::String(model.to_string()));
        if let Some(estimate) = estimate {
            tier_doc.insert(
                "estimatedRamMb".into(),
                Value::Number(serde_json::Number::from(estimate)),
            );
        }
        if tier == "small" {
            if let Some(models) = config.get_mut("models").and_then(Value::as_object_mut) {
                models.insert("default".into(), Value::String(model.to_string()));
            }
        }
        drop(config);
        Ok(self.tiers_snapshot().await)
    }

    async fn tiers_snapshot(&self) -> HashMap<String, String> {
        let config = self.config.lock().await;
        config
            .pointer("/models/tiers")
            .and_then(Value::as_object)
            .map(|tiers| {
                tiers
                    .iter()
                    .filter_map(|(tier, doc)| {
                        doc.get("name")
                            .and_then(Value::as_str)
                            .map(|name| (tier.clone(), name.to_string()))
                    })
                    .collect()
            })
            .unwrap_or_default()
    }

    async fn list_installed(&self) -> Vec<ModelLibraryEntry> {
        let url = format!("{}/api/tags", self.ollama_base_url.trim_end_matches('/'));
        match self.client.get(url).send().await {
            Ok(response) if response.status().is_success() => {
                #[derive(serde::Deserialize)]
                struct TagsResponse {
                    models: Option<Vec<TagModel>>,
                }
                #[derive(serde::Deserialize)]
                struct TagModel {
                    name: Option<String>,
                }
                let payload: TagsResponse = response
                    .json()
                    .await
                    .unwrap_or(TagsResponse { models: None });
                payload
                    .models
                    .unwrap_or_default()
                    .into_iter()
                    .filter_map(|item| {
                        let name = item.name?.trim().to_string();
                        if name.is_empty() {
                            return None;
                        }
                        Some(ModelLibraryEntry {
                            id: name.clone(),
                            label: name.clone(),
                            source: "installed".into(),
                            ollama_model: Some(name),
                            description: "Installed Ollama model.".into(),
                            tags: vec!["installed".into()],
                            estimated_ram_mb: None,
                            status: "installed".into(),
                            reason: None,
                            disabled: None,
                            disabled_reason: None,
                        })
                    })
                    .collect()
            }
            Ok(response) => vec![ModelLibraryEntry {
                id: "ollama-unavailable".into(),
                label: "Ollama unavailable".into(),
                source: "installed".into(),
                ollama_model: None,
                description: "Installed model list could not be loaded.".into(),
                tags: vec!["error".into()],
                estimated_ram_mb: None,
                status: "failed".into(),
                reason: Some(format!("HTTP {}", response.status())),
                disabled: None,
                disabled_reason: None,
            }],
            Err(err) => vec![ModelLibraryEntry {
                id: "ollama-unavailable".into(),
                label: "Ollama unavailable".into(),
                source: "installed".into(),
                ollama_model: None,
                description: "Installed model list could not be loaded.".into(),
                tags: vec!["error".into()],
                estimated_ram_mb: None,
                status: "failed".into(),
                reason: Some(err.to_string()),
                disabled: None,
                disabled_reason: None,
            }],
        }
    }

    async fn run_install(&self, model: &str) {
        let job_id = {
            let mut jobs = self.jobs.lock().await;
            let Some(job) = jobs.values_mut().find(|job| job.model == model) else {
                return;
            };
            job.status = "running".into();
            job.message = "pulling model".into();
            job.id.clone()
        };

        let url = format!("{}/api/pull", self.ollama_base_url.trim_end_matches('/'));
        let result = self
            .client
            .post(url)
            .header("content-type", "application/json")
            .json(&serde_json::json!({ "name": model, "stream": false }))
            .send()
            .await;

        let mut jobs = self.jobs.lock().await;
        let Some(job) = jobs.get_mut(&job_id) else {
            return;
        };
        match result {
            Ok(response) if response.status().is_success() => {
                job.status = "ready".into();
                job.progress = 1.0;
                job.message = "ready".into();
                job.completed_at = Some(now_rfc3339());
            }
            Ok(response) => {
                job.status = "failed".into();
                job.progress = 0.0;
                job.message = format!("Ollama pull failed: HTTP {}", response.status());
                job.completed_at = Some(now_rfc3339());
            }
            Err(err) => {
                job.status = "failed".into();
                job.progress = 0.0;
                job.message = err.to_string();
                job.completed_at = Some(now_rfc3339());
            }
        }
    }
}

fn now_rfc3339() -> String {
    time::OffsetDateTime::now_utc()
        .format(&time::format_description::well_known::Rfc3339)
        .unwrap_or_else(|_| "unknown".into())
}

fn now_epoch_ms() -> u128 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|duration| duration.as_millis())
        .unwrap_or(0)
}
