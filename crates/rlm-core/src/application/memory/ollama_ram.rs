use reqwest::Client;
use serde_json::Value;

use super::ram_budget::estimate_model_ram_mb;
use super::ram_eligibility::{assert_model_ram_eligible, assert_runtime_ram_eligible};

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
