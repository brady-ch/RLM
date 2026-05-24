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
