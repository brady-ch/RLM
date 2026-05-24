use serde_json::Value;

use crate::model_library::CURATED_MODELS;

use super::ram_probe::{current_free_ram_mb, is_wsl};

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

#[cfg(test)]
#[path = "../../../tests/application/memory/ram_budget.rs"]
mod ram_budget_tests;
