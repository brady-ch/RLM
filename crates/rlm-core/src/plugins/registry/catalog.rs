use std::path::Path;

use serde::{Deserialize, Serialize};

use super::types::PluginMutationResult;

#[derive(Debug, Clone, Deserialize, Serialize)]
pub(crate) struct InstalledPluginCatalogEntry {
    pub id: String,
    pub path: String,
    pub enabled: bool,
}

#[derive(Debug, Clone, Deserialize, Serialize, Default)]
pub(crate) struct InstalledPluginCatalog {
    #[serde(default)]
    pub plugins: Vec<InstalledPluginCatalogEntry>,
}

#[derive(Debug, Clone)]
pub(crate) struct LegacyExtensionEntry {
    pub path: String,
    #[allow(dead_code)]
    pub agents: Vec<String>,
}

pub(crate) struct NormalizedExtensionEntry {
    pub id: String,
    pub path: String,
    pub enabled: bool,
}

pub fn mutation_result(id: &str) -> PluginMutationResult {
    PluginMutationResult {
        ok: true,
        id: id.to_string(),
        requires_restart: true,
    }
}

pub(crate) fn read_catalog(path: &Path) -> Result<InstalledPluginCatalog, String> {
    if !path.exists() {
        return Ok(InstalledPluginCatalog::default());
    }
    let raw = std::fs::read_to_string(path).map_err(|err| err.to_string())?;
    serde_json::from_str(&raw).map_err(|err| err.to_string())
}

pub(crate) fn write_catalog(path: &Path, catalog: &InstalledPluginCatalog) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|err| err.to_string())?;
    }
    if catalog.plugins.is_empty() {
        let _ = std::fs::remove_file(path);
        return Ok(());
    }
    let raw = serde_json::to_string_pretty(catalog).map_err(|err| err.to_string())?;
    std::fs::write(path, format!("{raw}\n")).map_err(|err| err.to_string())
}

pub(crate) fn normalize_legacy_extensions(
    entries: &[LegacyExtensionEntry],
    config_file_path: &Path,
) -> Vec<NormalizedExtensionEntry> {
    let config_dir = config_file_path.parent().unwrap_or_else(|| Path::new("."));
    entries
        .iter()
        .map(|entry| {
            let path = if Path::new(&entry.path).is_absolute() {
                entry.path.clone()
            } else {
                config_dir.join(&entry.path).display().to_string()
            };
            let id = Path::new(&path)
                .file_name()
                .and_then(|name| name.to_str())
                .unwrap_or("extension")
                .to_string();
            NormalizedExtensionEntry {
                id,
                path,
                enabled: true,
            }
        })
        .collect()
}

pub(crate) fn legacy_extensions_from_config(
    config: &serde_json::Value,
) -> Vec<LegacyExtensionEntry> {
    config
        .get("extensions")
        .and_then(|ext| ext.get("load"))
        .and_then(|v| v.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|entry| {
                    Some(LegacyExtensionEntry {
                        path: entry.get("path")?.as_str()?.to_string(),
                        agents: entry
                            .get("agents")
                            .and_then(|v| v.as_array())
                            .map(|agents| {
                                agents
                                    .iter()
                                    .filter_map(|v| v.as_str().map(String::from))
                                    .collect()
                            })
                            .unwrap_or_default(),
                    })
                })
                .collect()
        })
        .unwrap_or_default()
}
