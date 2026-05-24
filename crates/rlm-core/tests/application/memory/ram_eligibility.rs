use super::*;
use serde_json::json;

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
