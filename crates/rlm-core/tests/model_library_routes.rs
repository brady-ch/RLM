use rlm_core::control_server::RouterState;
use rlm_core::{start_server, ServerConfig};
use serde_json::{json, Value};

fn project_config() -> Value {
    json!({
        "models": {
            "default": "granite4.1:3b",
            "tiers": {
                "small": { "name": "granite4.1:3b", "estimatedRamMb": 4096 },
                "medium": { "name": "llama3.1:8b", "estimatedRamMb": 8192 }
            }
        },
        "hosts": {
            "local_ollama": {
                "kind": "ollama",
                "baseUrl": "http://127.0.0.1:11434",
                "allowUnconstrainedToolCalls": false
            }
        },
        "runtimeHost": "local_ollama"
    })
}

fn constrained_project_config() -> Value {
    let mut config = project_config();
    config["models"]["tiers"]["medium"] = json!({
        "name": "llama3.1:8b",
        "estimatedRamMb": 4096
    });
    config["memory"] = json!({
        "maxRamMb": 7952,
        "reserveSystemRamMb": 0,
        "waitForCapacity": false,
        "capacityCheckIntervalMs": 1
    });
    config
}

fn write_project_config(dir: &std::path::Path, config: &Value) {
    std::fs::write(
        dir.join("rlm.config.yaml"),
        serde_yaml::to_string(
            &serde_json::from_value::<serde_yaml::Value>(config.clone()).unwrap(),
        )
        .expect("yaml"),
    )
    .expect("write config");
}

#[tokio::test]
async fn model_library_routes_support_catalog_and_tier_select() {
    let temp = tempfile::tempdir().expect("tempdir");
    write_project_config(temp.path(), &project_config());

    let server = start_server(ServerConfig {
        port: 0,
        ui_dist_dir: None,
        project_root: temp.path().to_path_buf(),
        memory_session_id: None,
        session: None,
        ..Default::default()
    })
    .await
    .expect("start server");

    let client = reqwest::Client::new();
    let catalog = client
        .get(format!("{}/api/model-library", server.url))
        .send()
        .await
        .expect("catalog");
    assert_eq!(catalog.status(), reqwest::StatusCode::OK);
    let catalog_body: Value = catalog.json().await.expect("json");
    assert!(catalog_body.get("curated").is_some());
    assert!(catalog_body.get("tiers").is_some());

    let select = client
        .post(format!("{}/api/model-library/select-tier", server.url))
        .json(&json!({ "tier": "medium", "model": "granite4.1:3b" }))
        .send()
        .await
        .expect("select tier");
    assert_eq!(select.status(), reqwest::StatusCode::OK);
    let body: Value = select.json().await.expect("json");
    assert_eq!(
        body.pointer("/tiers/medium").and_then(Value::as_str),
        Some("granite4.1:3b")
    );

    server.close().await;
}

#[tokio::test]
async fn model_library_disables_and_rejects_models_above_ram_limit() {
    let temp = tempfile::tempdir().expect("tempdir");
    write_project_config(temp.path(), &constrained_project_config());

    let server = start_server(ServerConfig {
        port: 0,
        ui_dist_dir: None,
        project_root: temp.path().to_path_buf(),
        memory_session_id: None,
        session: None,
        ..Default::default()
    })
    .await
    .expect("start server");

    let client = reqwest::Client::new();
    let catalog = client
        .get(format!("{}/api/model-library", server.url))
        .send()
        .await
        .expect("catalog");
    assert_eq!(catalog.status(), reqwest::StatusCode::OK);
    let catalog_body: Value = catalog.json().await.expect("json");
    let large = catalog_body
        .get("curated")
        .and_then(Value::as_array)
        .and_then(|entries| {
            entries
                .iter()
                .find(|entry| entry.get("id").and_then(Value::as_str) == Some("qwen2.5-coder:14b"))
        })
        .expect("large model entry");
    assert_eq!(
        large.get("status").and_then(Value::as_str),
        Some("available")
    );
    assert_eq!(large.get("disabled").and_then(Value::as_bool), Some(true));
    assert!(large
        .get("disabledReason")
        .and_then(Value::as_str)
        .unwrap_or_default()
        .contains("requires 16000 MB but only 7952 MB is available"));
    let installed = catalog_body
        .get("installed")
        .and_then(Value::as_array)
        .and_then(|entries| {
            entries
                .iter()
                .find(|entry| entry.get("id").and_then(Value::as_str) == Some("qwen2.5-coder:14b"))
        });
    if let Some(installed) = installed {
        assert_eq!(
            installed.get("disabled").and_then(Value::as_bool),
            Some(true)
        );
    }

    let select = client
        .post(format!("{}/api/model-library/select-tier", server.url))
        .json(&json!({ "tier": "medium", "model": "qwen2.5-coder:14b" }))
        .send()
        .await
        .expect("select tier");
    assert_eq!(select.status(), reqwest::StatusCode::BAD_REQUEST);
    let body: Value = select.json().await.expect("json");
    assert!(body
        .get("error")
        .and_then(Value::as_str)
        .unwrap_or_default()
        .contains("requires 16000 MB but only 7952 MB is available"));

    let install = client
        .post(format!("{}/api/model-library/install", server.url))
        .json(&json!({ "model": "qwen2.5-coder:14b" }))
        .send()
        .await
        .expect("install model");
    assert_eq!(install.status(), reqwest::StatusCode::BAD_REQUEST);
    let body: Value = install.json().await.expect("json");
    assert!(body
        .get("error")
        .and_then(Value::as_str)
        .unwrap_or_default()
        .contains("requires 16000 MB but only 7952 MB is available"));

    server.close().await;
}

#[tokio::test]
async fn select_tier_refreshes_router_plan_model() {
    let temp = tempfile::tempdir().expect("tempdir");
    write_project_config(temp.path(), &project_config());

    let server = start_server(ServerConfig {
        port: 0,
        ui_dist_dir: None,
        project_root: temp.path().to_path_buf(),
        memory_session_id: None,
        session: None,
        ..Default::default()
    })
    .await
    .expect("start server");

    let state = server.router_state();
    assert_eq!(
        state.plan_model().model_label(),
        Some("llama3.1:8b"),
        "initial medium tier from config"
    );

    let client = reqwest::Client::new();
    let select = client
        .post(format!("{}/api/model-library/select-tier", server.url))
        .json(&json!({ "tier": "medium", "model": "granite4.1:3b" }))
        .send()
        .await
        .expect("select tier");
    assert_eq!(select.status(), reqwest::StatusCode::OK);

    assert_eq!(
        state.plan_model().model_label(),
        Some("granite4.1:3b"),
        "plan model refreshed after tier select"
    );

    server.close().await;
}

#[test]
fn router_state_wires_model_library_when_configured() {
    let temp = tempfile::tempdir().expect("tempdir");
    write_project_config(temp.path(), &project_config());

    let state = RouterState::new(temp.path().to_path_buf());
    assert!(state.model_library.is_some());
    assert!(state
        .project_config
        .as_ref()
        .and_then(|loaded| loaded.path.as_ref())
        .is_some());
}

#[tokio::test]
async fn hf_download_requires_repo_id() {
    use rlm_core::model_library::HfRegistry;

    let temp = tempfile::tempdir().expect("tempdir");
    let registry = HfRegistry::new(temp.path().join("registry"));
    let err = registry.download_gguf("  ", None).await;
    assert!(err.is_err());
}
