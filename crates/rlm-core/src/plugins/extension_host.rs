use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::Arc;

use crate::interop::resolve_config_path;
use crate::ports::{ManifestSkillLoader, SkillLoader, Tool};

pub struct ExtensionHost {
    tools: HashMap<String, Arc<dyn Tool>>,
    skill_loaders: HashMap<String, Arc<dyn SkillLoader>>,
}

impl Clone for ExtensionHost {
    fn clone(&self) -> Self {
        Self {
            tools: self.tools.clone(),
            skill_loaders: self.skill_loaders.clone(),
        }
    }
}

impl Default for ExtensionHost {
    fn default() -> Self {
        Self::new()
    }
}

impl ExtensionHost {
    pub fn new() -> Self {
        Self {
            tools: HashMap::new(),
            skill_loaders: HashMap::new(),
        }
    }

    pub fn register_tool(&mut self, tool: Arc<dyn Tool>) -> Result<(), String> {
        let name = tool.name().to_string();
        if self.tools.contains_key(&name) {
            return Err(format!("Duplicate tool registration: {name}"));
        }
        self.tools.insert(name, tool);
        Ok(())
    }

    pub fn register_skill_loader(&mut self, loader: Arc<dyn SkillLoader>) -> Result<(), String> {
        let name = loader.name().to_string();
        if self.skill_loaders.contains_key(&name) {
            return Err(format!("Duplicate skill loader registration: {name}"));
        }
        self.skill_loaders.insert(name, loader);
        Ok(())
    }

    pub fn get_tool(&self, name: &str) -> Option<Arc<dyn Tool>> {
        self.tools.get(name).cloned()
    }

    pub fn get_skill_loader(&self, name: &str) -> Option<Arc<dyn SkillLoader>> {
        self.skill_loaders.get(name).cloned()
    }

    pub fn skill_loader_names(&self) -> Vec<String> {
        let mut names: Vec<_> = self.skill_loaders.keys().cloned().collect();
        names.sort();
        names
    }

    pub fn all_tools(&self) -> Vec<Arc<dyn Tool>> {
        self.tools.values().cloned().collect()
    }

    pub fn tool_names(&self) -> Vec<String> {
        let mut names: Vec<_> = self.tools.keys().cloned().collect();
        names.sort();
        names
    }
}

pub(crate) fn resolve_manifest_loader_path(plugin_root: &Path, loader_path: &str) -> Result<PathBuf, String> {
    let resolved = resolve_config_path(plugin_root, loader_path);
    let plugin_root = plugin_root
        .canonicalize()
        .unwrap_or_else(|_| plugin_root.to_path_buf());
    let canonical = resolved
        .canonicalize()
        .unwrap_or_else(|_| resolved.clone());
    if !canonical.starts_with(&plugin_root) {
        return Err(format!(
            "Skill loader path escapes plugin root: {}",
            resolved.display()
        ));
    }
    Ok(resolved)
}

pub async fn register_manifest_skill_loaders_async(
    host: &mut ExtensionHost,
    plugin_root: &Path,
    skill_loader_paths: &[String],
) -> Result<Vec<String>, String> {
    let mut warnings = Vec::new();
    for loader_path in skill_loader_paths {
        let resolved = match resolve_manifest_loader_path(plugin_root, loader_path) {
            Ok(path) => path,
            Err(err) => {
                warnings.push(err);
                continue;
            }
        };
        let name = loader_path.clone();
        let loader = Arc::new(ManifestSkillLoader::new(name.clone(), resolved));
        if let Err(err) = loader.load().await {
            warnings.push(format!(
                "Skill loader {} failed to load at {}: {err}",
                name,
                loader.root_path().display()
            ));
            continue;
        }
        host.register_skill_loader(loader)?;
    }
    Ok(warnings)
}

pub fn register_manifest_skill_loaders(
    host: &mut ExtensionHost,
    plugin_root: &Path,
    skill_loader_paths: &[String],
) -> Result<Vec<String>, String> {
    block_on_async(register_manifest_skill_loaders_async(
        host,
        plugin_root,
        skill_loader_paths,
    ))
}

fn block_on_async<F: std::future::Future>(future: F) -> F::Output {
    if let Ok(handle) = tokio::runtime::Handle::try_current() {
        return handle.block_on(future);
    }
    let runtime = tokio::runtime::Builder::new_current_thread()
        .enable_all()
        .build()
        .expect("runtime");
    runtime.block_on(future)
}
