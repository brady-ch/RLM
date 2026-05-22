use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::Arc;

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

pub fn register_manifest_skill_loaders(
    host: &mut ExtensionHost,
    plugin_root: &Path,
    skill_loader_paths: &[String],
) -> Result<(), String> {
    for loader_path in skill_loader_paths {
        let resolved = if Path::new(loader_path).is_absolute() {
            PathBuf::from(loader_path)
        } else {
            plugin_root.join(loader_path)
        };
        let name = loader_path.clone();
        host.register_skill_loader(Arc::new(ManifestSkillLoader::new(name, resolved)))?;
    }
    Ok(())
}
