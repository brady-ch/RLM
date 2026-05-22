use std::collections::HashMap;
use std::path::Path;

use serde_json::{json, Value};

use super::super::builtin::builtin_plugins;
use super::super::manifest::{read_and_validate_plugin_manifest, PluginManifest};
use super::super::remote_fetch::resolve_plugin_layout;
use super::catalog::{
    normalize_legacy_extensions, read_catalog, write_catalog, InstalledPluginCatalog,
    InstalledPluginCatalogEntry,
};
use super::service::PluginRegistryService;
use super::types::{PluginDoctorIssue, PluginDoctorResult};
use crate::interop::{parse_skill_config, resolve_config_path, validate_skill_search_paths};

impl PluginRegistryService {
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

    pub(crate) fn read_manifest_for_entry(
        &self,
        entry: &InstalledPluginCatalogEntry,
    ) -> Result<PluginManifest, String> {
        self.read_manifest_for_path(&entry.path)
    }

    pub(crate) fn read_manifest_for_path(&self, path: &str) -> Result<PluginManifest, String> {
        let plugin_path = Path::new(path);
        let root = if plugin_path.join("rlm.plugin.json").is_file() {
            plugin_path.to_path_buf()
        } else {
            resolve_plugin_layout(plugin_path)?.0
        };
        read_and_validate_plugin_manifest(&root.join("rlm.plugin.json"))
    }

    pub(crate) fn collect_skill_loader_issues(
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
