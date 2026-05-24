use rlm_core::persistence::load_project_config;
use rlm_core::plugins::PluginRegistryService;
use rlm_core::ports::PluginRegistryConfig;

fn sample_manifest(id: &str) -> serde_json::Value {
    serde_json::json!({
        "id": id,
        "name": "Demo Plugin",
        "version": "1.0.0",
        "category": "shell",
        "contributes": { "tools": ["demo_tool"] },
        "engines": { "rlm": ">=1.0.0" }
    })
}

fn write_sample_plugin(root: &std::path::Path, id: &str) -> std::path::PathBuf {
    let dir = root.join("sample-plugin");
    std::fs::create_dir_all(&dir).expect("mkdir");
    std::fs::write(
        dir.join("rlm.plugin.json"),
        serde_json::to_string(&sample_manifest(id)).expect("json"),
    )
    .expect("manifest");
    dir
}

#[tokio::test]
async fn registry_lists_builtins_and_installs_local_plugin() {
    let temp = tempfile::tempdir().expect("tempdir");
    let config = serde_json::json!({
        "models": { "default": "granite4.1:3b" }
    });
    std::fs::write(
        temp.path().join("rlm.config.yaml"),
        serde_yaml::to_string(
            &serde_json::from_value::<serde_yaml::Value>(config.clone()).unwrap(),
        )
        .unwrap(),
    )
    .unwrap();

    let user_root = temp.path().join("user-plugins");
    let user_catalog = user_root.join("catalog.json");
    std::fs::create_dir_all(&user_root).unwrap();

    let loaded = load_project_config(temp.path(), None).expect("config");
    let registry_config = PluginRegistryConfig {
        project_config: loaded.config.clone(),
        config_file_path: loaded
            .path
            .clone()
            .unwrap_or_else(|| temp.path().join("rlm.config.yaml")),
    };
    let registry = PluginRegistryService::new(temp.path().to_path_buf(), &registry_config)
        .with_catalog_overrides(user_catalog, user_root.clone());

    let source = write_sample_plugin(temp.path(), "demo.test.plugin");
    let installed = registry
        .install_local(source.strip_prefix(temp.path()).unwrap().to_str().unwrap())
        .await
        .expect("install");
    assert!(installed.requires_restart);

    let plugins = registry.list().await.expect("list");
    assert!(plugins.iter().any(|p| p.id == "rlm.builtin.shell"));
    assert!(plugins.iter().any(|p| p.id == "demo.test.plugin"));
}

#[test]
fn remote_fetch_rejects_zip_slip_entry() {
    use rlm_core::plugins::remote_fetch::is_unsafe_archive_entry_path;

    let root = tempfile::tempdir().expect("tempdir");
    assert!(is_unsafe_archive_entry_path("../escape.txt", root.path()));
}
