use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};

use super::builtin::builtin_plugins;
use super::manifest::{read_and_validate_plugin_manifest, PluginManifest};
use super::paths::{
    project_plugin_catalog_path, user_plugin_catalog_path, user_plugin_install_dir,
    user_plugins_root,
};
use super::remote_fetch::{
    fetch_remote_plugin_to_staging, is_remote_install_source, resolve_plugin_layout,
};
use crate::interop::{parse_skill_config, resolve_config_path, validate_skill_search_paths};
use crate::persistence::LoadedProjectConfig;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum PluginListSource {
    Builtin,
    Local,
    Configured,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PluginListItem {
    pub id: String,
    pub name: String,
    pub version: String,
    pub category: String,
    pub source: PluginListSource,
    pub enabled: bool,
    pub path: String,
    pub tools: Vec<String>,
    pub skill_loaders: Vec<String>,
    pub model_hosts: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct PluginMutationResult {
    pub ok: bool,
    pub id: String,
    pub requires_restart: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PluginInstallRemotePreview {
    pub ok: bool,
    pub needs_confirm: bool,
    pub id: String,
    pub source: String,
    pub manifest: PluginManifest,
}

#[derive(Debug, Clone, Serialize)]
pub struct PluginDoctorIssue {
    pub code: String,
    pub severity: String,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub plugin_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub path: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct PluginDoctorResult {
    pub ok: bool,
    pub issues: Vec<PluginDoctorIssue>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub fixes_applied: Option<Vec<String>>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
struct InstalledPluginCatalogEntry {
    id: String,
    path: String,
    enabled: bool,
}

#[derive(Debug, Clone, Deserialize, Serialize, Default)]
struct InstalledPluginCatalog {
    #[serde(default)]
    plugins: Vec<InstalledPluginCatalogEntry>,
}

pub struct PluginRegistryService {
    project_root: PathBuf,
    project_config: Value,
    config_file_path: PathBuf,
    allowlist_path: PathBuf,
    legacy_extensions: Vec<LegacyExtensionEntry>,
    user_catalog_path: PathBuf,
    user_plugins_root: PathBuf,
    project_catalog_path: PathBuf,
    http_client: reqwest::Client,
}

#[derive(Debug, Clone)]
struct LegacyExtensionEntry {
    path: String,
    #[allow(dead_code)]
    agents: Vec<String>,
}

impl PluginRegistryService {
    pub fn new(project_root: PathBuf, loaded_config: &LoadedProjectConfig) -> Self {
        let config_file_path = loaded_config
            .path
            .clone()
            .unwrap_or_else(|| project_root.join("rlm.config.yaml"));
        let legacy_extensions = loaded_config
            .config
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
            .unwrap_or_default();
        let allowlist_path = loaded_config
            .config
            .get("extensions")
            .and_then(|ext| ext.get("allowlist"))
            .and_then(|v| v.as_str())
            .map(|path| {
                if Path::new(path).is_absolute() {
                    PathBuf::from(path)
                } else {
                    config_file_path
                        .parent()
                        .unwrap_or(&project_root)
                        .join(path)
                }
            })
            .unwrap_or_else(|| {
                config_file_path
                    .parent()
                    .unwrap_or(&project_root)
                    .join(".rlm-allowlist.json")
            });
        Self {
            project_root: project_root.clone(),
            project_config: loaded_config.config.clone(),
            config_file_path,
            allowlist_path,
            legacy_extensions,
            user_catalog_path: user_plugin_catalog_path(),
            user_plugins_root: user_plugins_root(),
            project_catalog_path: project_plugin_catalog_path(&project_root),
            http_client: reqwest::Client::new(),
        }
    }

    pub fn with_catalog_overrides(
        mut self,
        user_catalog_path: PathBuf,
        user_plugins_root: PathBuf,
    ) -> Self {
        self.user_catalog_path = user_catalog_path;
        self.user_plugins_root = user_plugins_root;
        self
    }

    pub async fn list(&self) -> Result<Vec<PluginListItem>, String> {
        let mut items = Vec::new();
        let mut seen = HashSet::new();

        for builtin in builtin_plugins() {
            items.push(self.to_list_item(
                &builtin.manifest,
                PluginListSource::Builtin,
                true,
                builtin.path,
            ));
            seen.insert(builtin.manifest.id.clone());
        }

        for catalog_path in [&self.user_catalog_path, &self.project_catalog_path] {
            let catalog = read_catalog(catalog_path)?;
            for entry in catalog.plugins {
                if seen.contains(&entry.id) {
                    continue;
                }
                let manifest = self.read_manifest_for_entry(&entry)?;
                items.push(self.to_list_item(
                    &manifest,
                    PluginListSource::Local,
                    entry.enabled,
                    &entry.path,
                ));
                seen.insert(entry.id);
            }
        }

        for entry in normalize_legacy_extensions(&self.legacy_extensions, &self.config_file_path) {
            if seen.contains(&entry.id) {
                continue;
            }
            let manifest = self.read_manifest_for_path(&entry.path)?;
            items.push(self.to_list_item(
                &manifest,
                PluginListSource::Configured,
                entry.enabled,
                &entry.path,
            ));
            seen.insert(entry.id);
        }

        items.sort_by(|a, b| a.id.cmp(&b.id));
        Ok(items)
    }

    pub async fn install(&self, source: &str, confirm: bool) -> Result<Value, String> {
        if is_remote_install_source(source) {
            return self.install_remote(source, confirm).await;
        }
        let result = self.install_local(source).await?;
        Ok(serde_json::to_value(result).unwrap_or(json!({})))
    }

    pub async fn install_local(
        &self,
        source_path_input: &str,
    ) -> Result<PluginMutationResult, String> {
        let source_path = self.project_root.join(source_path_input);
        if !source_path.exists() {
            return Err("Plugin source path not found".into());
        }
        let (root, entry_path) = resolve_plugin_layout(&source_path)?;
        self.install_from_root(&root, &entry_path, "local").await
    }

    pub async fn install_remote(&self, source_input: &str, confirm: bool) -> Result<Value, String> {
        let source = source_input.trim();
        let staging = fetch_remote_plugin_to_staging(source, &self.http_client).await?;
        let (root, entry_path) = resolve_plugin_layout(&staging.path)?;
        let manifest = read_and_validate_plugin_manifest(&root.join("rlm.plugin.json"))?;
        if !confirm {
            return Ok(serde_json::to_value(PluginInstallRemotePreview {
                ok: false,
                needs_confirm: true,
                id: manifest.id.clone(),
                source: source.to_string(),
                manifest,
            })
            .unwrap_or(json!({})));
        }
        let installed = self.install_from_root(&root, &entry_path, "remote").await?;
        Ok(serde_json::to_value(installed).unwrap_or(json!({})))
    }

    pub async fn enable(&self, plugin_id: &str) -> Result<PluginMutationResult, String> {
        self.set_enabled(plugin_id, true).await?;
        Ok(mutation_result(plugin_id))
    }

    pub async fn disable(&self, plugin_id: &str) -> Result<PluginMutationResult, String> {
        self.set_enabled(plugin_id, false).await?;
        Ok(mutation_result(plugin_id))
    }

    pub async fn uninstall(&self, plugin_id: &str) -> Result<PluginMutationResult, String> {
        if builtin_plugins().iter().any(|b| b.manifest.id == plugin_id) {
            return Err(format!("Cannot uninstall built-in plugin: {plugin_id}"));
        }
        let mut removed = false;
        for catalog_path in [&self.user_catalog_path, &self.project_catalog_path] {
            let mut catalog = read_catalog(catalog_path)?;
            let before = catalog.plugins.len();
            catalog.plugins.retain(|entry| entry.id != plugin_id);
            if catalog.plugins.len() != before {
                removed = true;
                write_catalog(catalog_path, &catalog)?;
            }
        }
        let install_dir = user_plugin_install_dir(plugin_id);
        if install_dir.exists() {
            std::fs::remove_dir_all(&install_dir).map_err(|err| err.to_string())?;
            removed = true;
        }
        if !removed {
            return Err(format!("Plugin not installed: {plugin_id}"));
        }
        Ok(mutation_result(plugin_id))
    }

    pub async fn doctor(&self, fix: bool) -> Result<PluginDoctorResult, String> {
        let mut issues = Vec::new();
        let mut fixes_applied = Vec::new();
        let mut ids = HashMap::<String, String>::new();

        for catalog_path in [&self.user_catalog_path, &self.project_catalog_path] {
            let catalog = read_catalog(catalog_path)?;
            let mut next_entries = Vec::new();
            for entry in catalog.plugins {
                if ids.contains_key(&entry.id) {
                    issues.push(PluginDoctorIssue {
                        code: "duplicate_id".into(),
                        severity: "error".into(),
                        message: format!("Duplicate plugin id {} in catalogs", entry.id),
                        plugin_id: Some(entry.id.clone()),
                        path: None,
                    });
                    if fix && catalog_path == &self.project_catalog_path {
                        fixes_applied.push(format!(
                            "Removed duplicate catalog entry for {} from project catalog",
                            entry.id
                        ));
                        continue;
                    }
                } else {
                    ids.insert(entry.id.clone(), catalog_path.display().to_string());
                }

                let mut keep_entry = true;
                if !Path::new(&entry.path).exists() {
                    issues.push(PluginDoctorIssue {
                        code: "missing_path".into(),
                        severity: "error".into(),
                        message: format!("Plugin path missing for {}: {}", entry.id, entry.path),
                        plugin_id: Some(entry.id.clone()),
                        path: Some(entry.path.clone()),
                    });
                    keep_entry = !fix;
                    if fix {
                        fixes_applied.push(format!("Quarantined missing plugin {}", entry.id));
                    }
                } else if let Err(err) = self.read_manifest_for_entry(&entry) {
                    issues.push(PluginDoctorIssue {
                        code: "invalid_manifest".into(),
                        severity: "error".into(),
                        message: err,
                        plugin_id: Some(entry.id.clone()),
                        path: Some(entry.path.clone()),
                    });
                    keep_entry = !fix;
                    if fix {
                        fixes_applied
                            .push(format!("Quarantined invalid manifest for {}", entry.id));
                    }
                } else if let Ok(manifest) = self.read_manifest_for_entry(&entry) {
                    if manifest.id != entry.id {
                        issues.push(PluginDoctorIssue {
                            code: "id_mismatch".into(),
                            severity: "error".into(),
                            message: format!(
                                "Catalog id {} does not match manifest id {}",
                                entry.id, manifest.id
                            ),
                            plugin_id: Some(entry.id.clone()),
                            path: Some(entry.path.clone()),
                        });
                        keep_entry = !fix;
                        if fix {
                            fixes_applied.push(format!("Quarantined id mismatch for {}", entry.id));
                        }
                    }
                }

                if keep_entry {
                    next_entries.push(entry);
                }
            }
            if fix {
                write_catalog(
                    catalog_path,
                    &InstalledPluginCatalog {
                        plugins: next_entries,
                    },
                )?;
            }
        }

        for entry in normalize_legacy_extensions(&self.legacy_extensions, &self.config_file_path) {
            if !Path::new(&entry.path).exists() {
                issues.push(PluginDoctorIssue {
                    code: "stale_config_ref".into(),
                    severity: "error".into(),
                    message: format!("Configured extension path missing: {}", entry.path),
                    plugin_id: Some(entry.id.clone()),
                    path: Some(entry.path.clone()),
                });
            }
        }

        let skill_config = parse_skill_config(Some(&self.project_config), &self.project_root);
        for warning in validate_skill_search_paths(&skill_config) {
            issues.push(PluginDoctorIssue {
                code: "invalid_skill_search_path".into(),
                severity: "warn".into(),
                message: warning,
                plugin_id: None,
                path: None,
            });
        }

        for catalog_path in [&self.user_catalog_path, &self.project_catalog_path] {
            let catalog = read_catalog(catalog_path)?;
            for entry in catalog.plugins {
                if let Ok(manifest) = self.read_manifest_for_entry(&entry) {
                    self.collect_skill_loader_issues(&entry.path, &manifest, &mut issues);
                }
            }
        }

        for builtin in builtin_plugins() {
            self.collect_skill_loader_issues(builtin.path, &builtin.manifest, &mut issues);
        }

        let has_errors = issues.iter().any(|issue| issue.severity == "error");
        Ok(PluginDoctorResult {
            ok: !has_errors,
            issues,
            fixes_applied: if fixes_applied.is_empty() {
                None
            } else {
                Some(fixes_applied)
            },
        })
    }

    pub async fn inspect(&self, plugin_id: &str) -> Result<Value, String> {
        if let Some(builtin) = builtin_plugins()
            .iter()
            .find(|b| b.manifest.id == plugin_id)
        {
            return Ok(json!({
                "manifest": builtin.manifest,
                "path": builtin.path,
            }));
        }
        for catalog_path in [&self.user_catalog_path, &self.project_catalog_path] {
            let catalog = read_catalog(catalog_path)?;
            if let Some(entry) = catalog.plugins.iter().find(|e| e.id == plugin_id) {
                let manifest = self.read_manifest_for_entry(entry)?;
                return Ok(json!({ "manifest": manifest, "path": entry.path }));
            }
        }
        for entry in normalize_legacy_extensions(&self.legacy_extensions, &self.config_file_path) {
            if entry.id == plugin_id {
                let manifest = self.read_manifest_for_path(&entry.path)?;
                return Ok(json!({ "manifest": manifest, "path": entry.path }));
            }
        }
        Err(format!("Unknown plugin id: {plugin_id}"))
    }

    pub async fn validate_path(&self, path_input: &str) -> Result<PluginManifest, String> {
        let abs_path = self.project_root.join(path_input);
        if !abs_path.exists() {
            return Err("Plugin path not found".into());
        }
        let (root, _) = resolve_plugin_layout(&abs_path)?;
        read_and_validate_plugin_manifest(&root.join("rlm.plugin.json"))
    }

    async fn install_from_root(
        &self,
        root: &Path,
        entry_path: &Path,
        _source_kind: &str,
    ) -> Result<PluginMutationResult, String> {
        let manifest = read_and_validate_plugin_manifest(&root.join("rlm.plugin.json"))?;
        let install_dir = self.user_plugins_root.join(&manifest.id);
        if install_dir.exists() {
            std::fs::remove_dir_all(&install_dir).map_err(|err| err.to_string())?;
        }
        copy_dir_recursive(root, &install_dir)?;
        self.pre_approve_allowlist(&install_dir.join(entry_path.file_name().unwrap_or_default()))?;

        let mut catalog = read_catalog(&self.user_catalog_path)?;
        catalog.plugins.retain(|entry| entry.id != manifest.id);
        catalog.plugins.push(InstalledPluginCatalogEntry {
            id: manifest.id.clone(),
            path: install_dir.display().to_string(),
            enabled: true,
        });
        write_catalog(&self.user_catalog_path, &catalog)?;
        Ok(mutation_result(&manifest.id))
    }

    async fn set_enabled(&self, plugin_id: &str, enabled: bool) -> Result<(), String> {
        if builtin_plugins().iter().any(|b| b.manifest.id == plugin_id) {
            return Err(format!(
                "Cannot change enable state for built-in plugin: {plugin_id}"
            ));
        }
        let mut updated = false;
        for catalog_path in [&self.user_catalog_path, &self.project_catalog_path] {
            let mut catalog = read_catalog(catalog_path)?;
            for entry in &mut catalog.plugins {
                if entry.id == plugin_id {
                    entry.enabled = enabled;
                    updated = true;
                }
            }
            if updated {
                write_catalog(catalog_path, &catalog)?;
                return Ok(());
            }
        }
        Err(format!("Plugin not installed: {plugin_id}"))
    }

    fn pre_approve_allowlist(&self, abs_path: &Path) -> Result<(), String> {
        let key = allowlist_key(abs_path);
        let mut allowlist = read_allowlist(&self.allowlist_path)?;
        allowlist.insert(key, abs_path.display().to_string());
        write_allowlist(&self.allowlist_path, &allowlist)
    }

    fn to_list_item(
        &self,
        manifest: &PluginManifest,
        source: PluginListSource,
        enabled: bool,
        path: &str,
    ) -> PluginListItem {
        PluginListItem {
            id: manifest.id.clone(),
            name: manifest.name.clone(),
            version: manifest.version.clone(),
            category: manifest.category.clone(),
            source,
            enabled,
            path: path.to_string(),
            tools: manifest.contributes.tools.clone(),
            skill_loaders: manifest.contributes.skill_loaders.clone(),
            model_hosts: manifest.contributes.model_hosts.clone(),
        }
    }

    fn read_manifest_for_entry(
        &self,
        entry: &InstalledPluginCatalogEntry,
    ) -> Result<PluginManifest, String> {
        self.read_manifest_for_path(&entry.path)
    }

    fn read_manifest_for_path(&self, path: &str) -> Result<PluginManifest, String> {
        let plugin_path = Path::new(path);
        let root = if plugin_path.join("rlm.plugin.json").is_file() {
            plugin_path.to_path_buf()
        } else {
            resolve_plugin_layout(plugin_path)?.0
        };
        read_and_validate_plugin_manifest(&root.join("rlm.plugin.json"))
    }

    fn collect_skill_loader_issues(
        &self,
        plugin_path: &str,
        manifest: &PluginManifest,
        issues: &mut Vec<PluginDoctorIssue>,
    ) {
        if manifest.contributes.skill_loaders.is_empty() {
            return;
        }
        let plugin_root = Path::new(plugin_path);
        let plugin_root = if plugin_root.is_file() {
            plugin_root.parent().unwrap_or(plugin_root)
        } else {
            plugin_root
        };
        for loader_path in &manifest.contributes.skill_loaders {
            let resolved = resolve_config_path(plugin_root, loader_path);
            if !resolved.is_dir() {
                issues.push(PluginDoctorIssue {
                    code: "invalid_skill_loader_path".into(),
                    severity: "warn".into(),
                    message: format!(
                        "Plugin {} declares skill loader path that is missing or not a directory: {}",
                        manifest.id, resolved.display()
                    ),
                    plugin_id: Some(manifest.id.clone()),
                    path: Some(resolved.display().to_string()),
                });
            }
        }
    }
}

fn mutation_result(id: &str) -> PluginMutationResult {
    PluginMutationResult {
        ok: true,
        id: id.to_string(),
        requires_restart: true,
    }
}

fn read_catalog(path: &Path) -> Result<InstalledPluginCatalog, String> {
    if !path.exists() {
        return Ok(InstalledPluginCatalog::default());
    }
    let raw = std::fs::read_to_string(path).map_err(|err| err.to_string())?;
    serde_json::from_str(&raw).map_err(|err| err.to_string())
}

fn write_catalog(path: &Path, catalog: &InstalledPluginCatalog) -> Result<(), String> {
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

struct NormalizedExtensionEntry {
    id: String,
    path: String,
    enabled: bool,
}

fn normalize_legacy_extensions(
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

fn allowlist_key(abs_path: &Path) -> String {
    let mut hasher = Sha256::new();
    hasher.update(abs_path.display().to_string().as_bytes());
    format!("{:x}", hasher.finalize())
}

fn read_allowlist(path: &Path) -> Result<HashMap<String, String>, String> {
    if !path.exists() {
        return Ok(HashMap::new());
    }
    let raw = std::fs::read_to_string(path).map_err(|err| err.to_string())?;
    serde_json::from_str(&raw).map_err(|err| err.to_string())
}

fn write_allowlist(path: &Path, allowlist: &HashMap<String, String>) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|err| err.to_string())?;
    }
    let raw = serde_json::to_string_pretty(allowlist).map_err(|err| err.to_string())?;
    std::fs::write(path, format!("{raw}\n")).map_err(|err| err.to_string())
}

fn copy_dir_recursive(from: &Path, to: &Path) -> Result<(), String> {
    std::fs::create_dir_all(to).map_err(|err| err.to_string())?;
    for entry in std::fs::read_dir(from).map_err(|err| err.to_string())? {
        let entry = entry.map_err(|err| err.to_string())?;
        let target = to.join(entry.file_name());
        if entry.file_type().map_err(|err| err.to_string())?.is_dir() {
            copy_dir_recursive(&entry.path(), &target)?;
        } else {
            std::fs::copy(entry.path(), target).map_err(|err| err.to_string())?;
        }
    }
    Ok(())
}
