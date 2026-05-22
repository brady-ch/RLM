use std::path::Path;

use serde_json::{json, Value};

use super::super::manifest::read_and_validate_plugin_manifest;
use super::super::remote_fetch::{
    fetch_remote_plugin_to_staging, is_remote_install_source, resolve_plugin_layout,
};
use super::allowlist::copy_dir_recursive;
use super::catalog::{mutation_result, read_catalog, write_catalog, InstalledPluginCatalogEntry};
use super::service::PluginRegistryService;
use super::types::{PluginInstallRemotePreview, PluginMutationResult};

impl PluginRegistryService {
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

    pub(crate) async fn install_from_root(
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

    pub(crate) async fn set_enabled(&self, plugin_id: &str, enabled: bool) -> Result<(), String> {
        use super::super::builtin::builtin_plugins;

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
}
