use rlm_core::control_server::RouterState;
use rlm_core::{start_server, ServerConfig};
use serde_json::{json, Value};

fn project_config() -> Value {
    json!({
        "models": {
            "default": "granite4.1:3b"
        },
        "hosts": {
            "local_ollama": {
                "kind": "ollama",
                "baseUrl": "http://127.0.0.1:11434"
            }
        },
        "runtimeHost": "local_ollama"
    })
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
async fn plugin_routes_list_builtins_when_configured() {
    let temp = tempfile::tempdir().expect("tempdir");
    write_project_config(temp.path(), &project_config());

    let server = start_server(ServerConfig {
        port: 0,
        ui_dist_dir: None,
        project_root: temp.path().to_path_buf(),
        memory_session_id: None,
        session: None,
    })
    .await
    .expect("start server");

    let client = reqwest::Client::new();
    let response = client
        .get(format!("{}/api/plugins", server.url))
        .send()
        .await
        .expect("list");
    assert_eq!(response.status(), reqwest::StatusCode::OK);
    let body: Value = response.json().await.expect("json");
    let plugins = body
        .get("plugins")
        .and_then(Value::as_array)
        .expect("plugins");
    assert!(plugins
        .iter()
        .any(|plugin| { plugin.get("id").and_then(Value::as_str) == Some("rlm.builtin.shell") }));

    let doctor = client
        .get(format!("{}/api/plugins/doctor", server.url))
        .send()
        .await
        .expect("doctor");
    assert_eq!(doctor.status(), reqwest::StatusCode::OK);
    let doctor_body: Value = doctor.json().await.expect("doctor json");
    assert_eq!(doctor_body.get("ok").and_then(Value::as_bool), Some(true));

    server.close().await;
}

#[test]
fn router_state_wires_plugin_registry_when_configured() {
    let temp = tempfile::tempdir().expect("tempdir");
    write_project_config(temp.path(), &project_config());
    let state = RouterState::new(temp.path().to_path_buf());
    assert!(state.plugin_registry.is_some());
    assert!(state.runtime_context.is_some());
    let tools: Vec<_> = state
        .runtime_tools()
        .iter()
        .map(|tool| tool.name().to_string())
        .collect();
    assert!(tools.contains(&"shell".to_string()));
}

#[tokio::test]
async fn shell_tool_rejects_disallowed_command() {
    use rlm_core::plugins::builtin::GuardedShellTool;
    use rlm_core::ports::Tool;

    let temp = tempfile::tempdir().expect("tempdir");
    let tool = GuardedShellTool::new(temp.path());
    let result = tool.execute(json!({ "command": "rm -rf /" })).await;
    assert!(result.is_error);
}
