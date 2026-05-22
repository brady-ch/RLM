use std::collections::HashSet;
use std::path::{Path, PathBuf};

use serde_json::Value;

use super::super::builtin::builtin_plugins;
use super::super::manifest::PluginManifest;
use super::super::paths::{
    project_plugin_catalog_path, user_plugin_catalog_path, user_plugins_root,
};
use super::allowlist::{allowlist_key, read_allowlist, write_allowlist};
use super::catalog::{
    legacy_extensions_from_config, normalize_legacy_extensions, read_catalog, write_catalog,
    LegacyExtensionEntry,
};
use super::types::{PluginListItem, PluginListSource, PluginMutationResult};
use crate::persistence::LoadedProjectConfig;

pub struct PluginRegistryService {
    pub(crate) project_root: PathBuf,
    pub(crate) project_config: Value,
    pub(crate) config_file_path: PathBuf,
    pub(crate) allowlist_path: PathBuf,
    pub(crate) legacy_extensions: Vec<LegacyExtensionEntry>,
    pub(crate) user_catalog_path: PathBuf,
    pub(crate) user_plugins_root: PathBuf,
    pub(crate) project_catalog_path: PathBuf,
    pub(crate) http_client: reqwest::Client,
}

impl PluginRegistryService {
    pub fn new(project_root: PathBuf, loaded_config: &LoadedProjectConfig) -> Self {
        let config_file_path = loaded_config
            .path
            .clone()
            .unwrap_or_else(|| project_root.join("rlm.config.yaml"));
        let legacy_extensions = legacy_extensions_from_config(&loaded_config.config);
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

    pub async fn enable(&self, plugin_id: &str) -> Result<PluginMutationResult, String> {
        self.set_enabled(plugin_id, true).await?;
        Ok(super::catalog::mutation_result(plugin_id))
    }

    pub async fn disable(&self, plugin_id: &str) -> Result<PluginMutationResult, String> {
        self.set_enabled(plugin_id, false).await?;
        Ok(super::catalog::mutation_result(plugin_id))
    }

    pub async fn uninstall(&self, plugin_id: &str) -> Result<PluginMutationResult, String> {
        use super::super::paths::user_plugin_install_dir;

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
        Ok(super::catalog::mutation_result(plugin_id))
    }

    pub(crate) fn to_list_item(
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

    pub(crate) fn pre_approve_allowlist(&self, abs_path: &Path) -> Result<(), String> {
        let key = allowlist_key(abs_path);
        let mut allowlist = read_allowlist(&self.allowlist_path)?;
        allowlist.insert(key, abs_path.display().to_string());
        write_allowlist(&self.allowlist_path, &allowlist)
    }
}
