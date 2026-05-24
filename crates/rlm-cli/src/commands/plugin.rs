use std::path::PathBuf;

use rlm_core::persistence::load_project_config;
use rlm_core::plugins::{PluginListItem, PluginRegistryService};
use rlm_core::ports::PluginRegistryConfig;
use serde_json::Value;

use super::PluginCommands;

pub async fn run(
    sub: PluginCommands,
    project_root: PathBuf,
    config_path: Option<PathBuf>,
    json: bool,
) -> Result<(), Box<dyn std::error::Error>> {
    let loaded = load_project_config(&project_root, config_path.as_deref())
        .map_err(|err| format!("Failed to load project config: {err}"))?;
    let registry_config = PluginRegistryConfig {
        project_config: loaded.config.clone(),
        config_file_path: loaded
            .path
            .clone()
            .unwrap_or_else(|| project_root.join("rlm.config.yaml")),
    };
    let registry = PluginRegistryService::new(project_root, &registry_config);

    match sub {
        PluginCommands::List => run_list(&registry, json).await,
        PluginCommands::Install { source, yes } => run_install(&registry, &source, yes, json).await,
        PluginCommands::Enable { id } => {
            run_mutation(&registry, "enable", &id, json, |r, id| {
                Box::pin(r.enable(id))
            })
            .await
        }
        PluginCommands::Disable { id } => {
            run_mutation(&registry, "disable", &id, json, |r, id| {
                Box::pin(r.disable(id))
            })
            .await
        }
        PluginCommands::Uninstall { id } => {
            run_mutation(&registry, "uninstall", &id, json, |r, id| {
                Box::pin(r.uninstall(id))
            })
            .await
        }
        PluginCommands::Doctor { fix } => run_doctor(&registry, fix, json).await,
        PluginCommands::Inspect { id } => run_inspect(&registry, &id, json).await,
        PluginCommands::Validate { path } => run_validate(&registry, &path, json).await,
    }
}

async fn run_list(
    registry: &PluginRegistryService,
    json: bool,
) -> Result<(), Box<dyn std::error::Error>> {
    let plugins = registry.list().await.map_err(fail)?;
    if json {
        println!(
            "{}",
            serde_json::to_string_pretty(&serde_json::json!({ "plugins": plugins }))?
        );
        return Ok(());
    }
    if plugins.is_empty() {
        println!("No plugins found.");
        return Ok(());
    }
    for plugin in plugins {
        println!("{}", format_plugin_line(&plugin));
    }
    Ok(())
}

async fn run_install(
    registry: &PluginRegistryService,
    source: &str,
    yes: bool,
    json: bool,
) -> Result<(), Box<dyn std::error::Error>> {
    let result = registry.install(source, yes).await.map_err(fail)?;
    if result.get("needsConfirm").and_then(Value::as_bool) == Some(true) {
        if json {
            println!("{}", serde_json::to_string_pretty(&result)?);
        } else {
            eprintln!("Remote install requires confirmation. Re-run with --yes.");
            if let Some(id) = result.get("id").and_then(Value::as_str) {
                eprintln!("Plugin id: {id}");
            }
        }
        std::process::exit(1);
    }
    emit_mutation_json(result, json, "Installed plugin. Restart RLM to load it.")
}

async fn run_mutation<F>(
    registry: &PluginRegistryService,
    label: &str,
    id: &str,
    json: bool,
    op: F,
) -> Result<(), Box<dyn std::error::Error>>
where
    F: for<'a> FnOnce(
        &'a PluginRegistryService,
        &'a str,
    ) -> std::pin::Pin<
        Box<
            dyn std::future::Future<
                    Output = Result<rlm_core::plugins::PluginMutationResult, String>,
                > + Send
                + 'a,
        >,
    >,
{
    let result = op(registry, id).await.map_err(fail)?;
    let message = format!("{label}d plugin {id}. Restart RLM to apply changes.");
    emit_mutation(result, json, &message)
}

async fn run_doctor(
    registry: &PluginRegistryService,
    fix: bool,
    json: bool,
) -> Result<(), Box<dyn std::error::Error>> {
    let result = registry.doctor(fix).await.map_err(fail)?;
    if json {
        println!("{}", serde_json::to_string_pretty(&result)?);
    } else if result.issues.is_empty() {
        println!("Plugin doctor: no issues found.");
    } else {
        for issue in &result.issues {
            eprintln!("[{}] {}: {}", issue.severity, issue.code, issue.message);
        }
    }
    if !result.ok {
        std::process::exit(1);
    }
    Ok(())
}

async fn run_inspect(
    registry: &PluginRegistryService,
    id: &str,
    _json: bool,
) -> Result<(), Box<dyn std::error::Error>> {
    let detail = registry.inspect(id).await.map_err(fail)?;
    println!("{}", serde_json::to_string_pretty(&detail)?);
    Ok(())
}

async fn run_validate(
    registry: &PluginRegistryService,
    path: &str,
    json: bool,
) -> Result<(), Box<dyn std::error::Error>> {
    let manifest = registry.validate_path(path).await.map_err(fail)?;
    if json {
        println!("{}", serde_json::to_string_pretty(&manifest)?);
    } else {
        println!(
            "Valid manifest: {} {} ({})",
            manifest.id, manifest.version, manifest.category
        );
    }
    Ok(())
}

fn emit_mutation(
    result: rlm_core::plugins::PluginMutationResult,
    json: bool,
    message: &str,
) -> Result<(), Box<dyn std::error::Error>> {
    if json {
        emit_mutation_json(serde_json::to_value(result)?, json, message)
    } else {
        println!("{message}");
        Ok(())
    }
}

fn emit_mutation_json(
    value: Value,
    json: bool,
    message: &str,
) -> Result<(), Box<dyn std::error::Error>> {
    if json {
        println!("{}", serde_json::to_string_pretty(&value)?);
    } else {
        println!("{message}");
    }
    Ok(())
}

fn format_plugin_line(plugin: &PluginListItem) -> String {
    let state = if plugin.enabled {
        "enabled"
    } else {
        "disabled"
    };
    let tools = if plugin.tools.is_empty() {
        "no tools".to_string()
    } else {
        plugin.tools.join(", ")
    };
    format!(
        "{} v{} [{:?}] ({}) — {}",
        plugin.id, plugin.version, plugin.source, state, tools
    )
}

fn fail(message: String) -> Box<dyn std::error::Error> {
    Box::from(message)
}
