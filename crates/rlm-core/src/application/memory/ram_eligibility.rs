use serde_json::Value;

use super::ram_budget::{available_model_ram_mb, configured_cap_mb, peak_runtime_model_ram_mb, reserve_system_ram_mb};
use super::ram_probe::{current_free_ram_mb, is_wsl};

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

#[cfg(test)]
#[path = "../../../tests/application/memory/ram_eligibility.rs"]
mod ram_eligibility_tests;
