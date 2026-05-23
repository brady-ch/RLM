use reqwest::Client;
use serde_json::Value;

use crate::model_library::CURATED_MODELS;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RamSnapshot {
    pub total_ram_mb: Option<u32>,
    pub free_ram_mb: Option<u32>,
    pub configured_cap_mb: Option<u32>,
    pub reserve_mb: u32,
    pub ollama_loaded_mb: u32,
    pub available_ram_mb: Option<u32>,
    pub wsl_detected: bool,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ModelRamEligibility {
    pub disabled: bool,
    pub disabled_reason: Option<String>,
    pub snapshot: RamSnapshot,
}

pub fn is_wsl() -> bool {
    #[cfg(target_os = "linux")]
    {
        std::fs::read_to_string("/proc/version")
            .map(|version| version.to_lowercase().contains("microsoft"))
            .unwrap_or(false)
    }
    #[cfg(not(target_os = "linux"))]
    {
        false
    }
}

pub fn current_free_ram_mb() -> Option<u32> {
    #[cfg(target_os = "linux")]
    {
        let meminfo = std::fs::read_to_string("/proc/meminfo").ok()?;
        for key in ["MemAvailable:", "MemFree:"] {
            if let Some(kb) = meminfo.lines().find_map(|line| {
                let mut parts = line.split_whitespace();
                (parts.next() == Some(key)).then(|| parts.next())?
            }) {
                let kb = kb.parse::<u64>().ok()?;
                return u32::try_from(kb / 1024).ok();
            }
        }
        None
    }
    #[cfg(not(target_os = "linux"))]
    {
        None
    }
}

pub fn estimate_model_ram_mb(config: &Value, model: &str) -> Option<u32> {
    config
        .pointer("/models/tiers")
        .and_then(Value::as_object)
        .and_then(|tiers| {
            tiers.values().find_map(|tier| {
                if tier.get("name").and_then(Value::as_str) == Some(model) {
                    tier.get("estimatedRamMb")
                        .and_then(Value::as_u64)
                        .and_then(|value| u32::try_from(value).ok())
                } else {
                    None
                }
            })
        })
        .or_else(|| {
            CURATED_MODELS
                .iter()
                .find_map(|(id, _, _, ram, _)| (*id == model).then_some(*ram))
        })
}

pub fn configured_cap_mb(config: &Value) -> Option<u32> {
    let memory = config.get("memory")?;
    match memory.get("maxRamMb") {
        Some(Value::Number(value)) => value.as_u64().and_then(|value| u32::try_from(value).ok()),
        Some(Value::String(value)) if value == "auto" => None,
        _ => None,
    }
}

pub fn reserve_system_ram_mb(config: &Value) -> u32 {
    config
        .pointer("/memory/reserveSystemRamMb")
        .and_then(Value::as_u64)
        .and_then(|value| u32::try_from(value).ok())
        .unwrap_or(0)
}

pub fn available_model_ram_mb(config: &Value, ollama_loaded_mb: u32) -> Option<u32> {
    let memory = config.get("memory")?;
    let reserve = reserve_system_ram_mb(config);
    let wsl = is_wsl();

    let mut available = match memory.get("maxRamMb") {
        Some(Value::Number(value)) => value.as_u64().and_then(|value| u32::try_from(value).ok()),
        Some(Value::String(value)) if value == "auto" => {
            current_free_ram_mb().map(|free| free.saturating_sub(reserve))
        }
        _ => current_free_ram_mb().map(|free| free.saturating_sub(reserve)),
    }?;

    if wsl {
        if let Some(cap) = configured_cap_mb(config) {
            available = available.min(cap);
        } else {
            // WSL VM free memory does not reflect Windows host RAM used by Ollama.
            available = available.min(default_wsl_auto_cap_mb(config));
        }
    }

    Some(available.saturating_sub(ollama_loaded_mb))
}

fn default_wsl_auto_cap_mb(config: &Value) -> u32 {
    config
        .pointer("/memory/wslAutoCapMb")
        .and_then(Value::as_u64)
        .and_then(|value| u32::try_from(value).ok())
        .unwrap_or(4096)
}

pub fn ram_snapshot(config: &Value, ollama_loaded_mb: u32) -> RamSnapshot {
    RamSnapshot {
        total_ram_mb: None,
        free_ram_mb: current_free_ram_mb(),
        configured_cap_mb: configured_cap_mb(config),
        reserve_mb: reserve_system_ram_mb(config),
        ollama_loaded_mb,
        available_ram_mb: available_model_ram_mb(config, ollama_loaded_mb),
        wsl_detected: is_wsl(),
    }
}

pub fn model_ram_eligibility(
    estimated_ram_mb: Option<u32>,
    snapshot: &RamSnapshot,
) -> ModelRamEligibility {
    let Some(estimated) = estimated_ram_mb else {
        return ModelRamEligibility {
            disabled: false,
            disabled_reason: None,
            snapshot: snapshot.clone(),
        };
    };
    let Some(available) = snapshot.available_ram_mb else {
        return ModelRamEligibility {
            disabled: false,
            disabled_reason: None,
            snapshot: snapshot.clone(),
        };
    };
    if estimated <= available {
        return ModelRamEligibility {
            disabled: false,
            disabled_reason: None,
            snapshot: snapshot.clone(),
        };
    }
    ModelRamEligibility {
        disabled: true,
        disabled_reason: Some(format!(
            "Model requires {estimated} MB but only {available} MB is available."
        )),
        snapshot: snapshot.clone(),
    }
}

pub fn assert_model_ram_eligible(
    model: &str,
    estimated_ram_mb: Option<u32>,
    config: &Value,
    ollama_loaded_mb: u32,
) -> Result<(), String> {
    let snapshot = ram_snapshot(config, ollama_loaded_mb);
    let eligibility = model_ram_eligibility(estimated_ram_mb, &snapshot);
    if eligibility.disabled {
        return Err(format!(
            "Model \"{model}\" {}",
            eligibility
                .disabled_reason
                .unwrap_or_else(|| "is not eligible for the current memory budget.".into())
        ));
    }
    Ok(())
}

pub fn peak_runtime_model_ram_mb(config: &Value) -> Option<u32> {
    let mut peak = 0u32;
    if let Some(default_model) = config
        .pointer("/models/default")
        .and_then(Value::as_str)
        .map(str::to_string)
    {
        if let Some(estimate) = estimate_model_ram_mb(config, &default_model) {
            peak = peak.max(estimate);
        }
    }
    if let Some(tiers) = config.pointer("/models/tiers").and_then(Value::as_object) {
        for tier in tiers.values() {
            if let (Some(name), Some(estimate)) = (
                tier.get("name").and_then(Value::as_str),
                tier.get("estimatedRamMb")
                    .and_then(Value::as_u64)
                    .and_then(|value| u32::try_from(value).ok()),
            ) {
                let _ = name;
                peak = peak.max(estimate);
            }
        }
    }
    (peak > 0).then_some(peak)
}

pub fn validate_memory_budget(config: &Value) -> Result<(), String> {
    let Some(cap) = configured_cap_mb(config) else {
        return Ok(());
    };
    let mut violations: Vec<String> = Vec::new();
    if let Some(tiers) = config.pointer("/models/tiers").and_then(Value::as_object) {
        for (tier_id, tier) in tiers {
            let estimate = tier
                .get("estimatedRamMb")
                .and_then(Value::as_u64)
                .and_then(|value| u32::try_from(value).ok());
            if let Some(estimate) = estimate {
                if estimate > cap {
                    violations.push(format!(
                        "models.tiers.{tier_id}.estimatedRamMb ({estimate} MB) exceeds memory.maxRamMb ({cap} MB)"
                    ));
                }
            }
        }
    }
    if violations.is_empty() {
        Ok(())
    } else {
        Err(violations.join("; "))
    }
}

pub async fn unload_ollama_models(base_url: &str, models: &[String], client: &Client) {
    let url = format!("{}/api/generate", base_url.trim_end_matches('/'));
    for model in models {
        let _ = client
            .post(&url)
            .json(&serde_json::json!({
                "model": model,
                "prompt": "",
                "stream": false,
                "keep_alive": 0,
            }))
            .send()
            .await;
    }
}

pub fn configured_model_names(config: &Value) -> Vec<String> {
    let mut names = Vec::new();
    if let Some(default_model) = config.pointer("/models/default").and_then(Value::as_str) {
        names.push(default_model.to_string());
    }
    if let Some(tiers) = config.pointer("/models/tiers").and_then(Value::as_object) {
        for tier in tiers.values() {
            if let Some(name) = tier.get("name").and_then(Value::as_str) {
                if !names.iter().any(|existing| existing == name) {
                    names.push(name.to_string());
                }
            }
        }
    }
    names
}

pub fn assert_runtime_ram_eligible(
    config: &Value,
    ollama_loaded_mb: u32,
) -> Result<(), String> {
    let peak = peak_runtime_model_ram_mb(config).ok_or_else(|| {
        "No model RAM estimates configured; set models.tiers.*.estimatedRamMb.".to_string()
    })?;
    let snapshot = ram_snapshot(config, ollama_loaded_mb);
    let eligibility = model_ram_eligibility(Some(peak), &snapshot);
    if eligibility.disabled {
        return Err(format!(
            "Run blocked to prevent out-of-memory: {}",
            eligibility.disabled_reason.unwrap_or_else(|| {
                "configured models exceed the available memory budget.".into()
            })
        ));
    }
    Ok(())
}

pub fn resource_guard_json(config: &Value, ollama_loaded_mb: u32) -> Value {
    let snapshot = ram_snapshot(config, ollama_loaded_mb);
    let peak = peak_runtime_model_ram_mb(config);
    let eligibility = model_ram_eligibility(peak, &snapshot);
    serde_json::json!({
        "wslDetected": snapshot.wsl_detected,
        "availableRamMb": snapshot.available_ram_mb,
        "configuredCapMb": snapshot.configured_cap_mb,
        "reserveRamMb": snapshot.reserve_mb,
        "freeRamMb": snapshot.free_ram_mb,
        "ollamaLoadedRamMb": snapshot.ollama_loaded_mb,
        "peakModelRamMb": peak,
        "runBlocked": eligibility.disabled,
        "runBlockedReason": eligibility.disabled_reason,
    })
}

pub async fn ollama_loaded_ram_mb(base_url: &str, client: &Client) -> u32 {
    let url = format!("{}/api/ps", base_url.trim_end_matches('/'));
    let Ok(response) = client.get(url).send().await else {
        return 0;
    };
    if !response.status().is_success() {
        return 0;
    }
    let Ok(payload) = response.json::<Value>().await else {
        return 0;
    };
    payload
        .get("models")
        .and_then(Value::as_array)
        .map(|models| {
            models
                .iter()
                .filter_map(|model| {
                    model
                        .get("size_vram")
                        .or_else(|| model.get("size"))
                        .and_then(Value::as_u64)
                        .and_then(|bytes| u32::try_from(bytes / (1024 * 1024)).ok())
                })
                .sum()
        })
        .unwrap_or(0)
}

pub async fn assert_model_ram_eligible_async(
    model: &str,
    config: &Value,
    ollama_base_url: &str,
    client: &Client,
) -> Result<(), String> {
    let loaded = ollama_loaded_ram_mb(ollama_base_url, client).await;
    assert_model_ram_eligible(
        model,
        estimate_model_ram_mb(config, model),
        config,
        loaded,
    )
}

pub async fn assert_runtime_ram_eligible_async(
    config: &Value,
    ollama_base_url: &str,
    client: &Client,
) -> Result<(), String> {
    let loaded = ollama_loaded_ram_mb(ollama_base_url, client).await;
    assert_runtime_ram_eligible(config, loaded)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn validate_memory_budget_rejects_tier_above_cap() {
        let config = json!({
            "memory": { "maxRamMb": 4096 },
            "models": {
                "tiers": {
                    "large": { "name": "qwen2.5-coder:14b", "estimatedRamMb": 16000 }
                }
            }
        });
        let err = validate_memory_budget(&config).expect_err("should reject");
        assert!(err.contains("16000"));
        assert!(err.contains("4096"));
    }

    #[test]
    fn fixed_cap_blocks_models_above_budget() {
        let config = json!({
            "memory": {
                "maxRamMb": 4096,
                "reserveSystemRamMb": 512
            },
            "models": {
                "default": "granite4.1:3b",
                "tiers": {
                    "medium": { "name": "llama3.1:8b", "estimatedRamMb": 8192 }
                }
            }
        });
        let snapshot = ram_snapshot(&config, 0);
        assert_eq!(snapshot.available_ram_mb, Some(4096));
        let err = assert_runtime_ram_eligible(&config, 0).expect_err("should block");
        assert!(err.contains("Run blocked"));
    }

    #[test]
    fn ollama_loaded_memory_reduces_available_budget() {
        let config = json!({
            "memory": { "maxRamMb": 4096, "reserveSystemRamMb": 0 },
            "models": {
                "default": "granite4.1:3b",
                "tiers": {
                    "small": { "name": "granite4.1:3b", "estimatedRamMb": 2048 }
                }
            }
        });
        assert!(assert_runtime_ram_eligible(&config, 0).is_ok());
        assert!(assert_runtime_ram_eligible(&config, 2500).is_err());
    }
}
