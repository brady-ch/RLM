use serde_json::Value;

fn configured_cap_mb(config: &Value) -> Option<u32> {
    let memory = config.get("memory")?;
    match memory.get("maxRamMb") {
        Some(Value::Number(value)) => value.as_u64().and_then(|value| u32::try_from(value).ok()),
        Some(Value::String(value)) if value == "auto" => None,
        _ => None,
    }
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
