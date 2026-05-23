use std::path::{Path, PathBuf};
use std::sync::Mutex;

use async_trait::async_trait;

/// Declarative skill loader registered from plugin manifest `skillLoaders`.
#[async_trait]
pub trait SkillLoader: Send + Sync {
    fn name(&self) -> &str;
    fn root_path(&self) -> &Path;
    fn search_paths(&self) -> Vec<PathBuf>;
    async fn load(&self) -> Result<(), String>;
}

pub struct ManifestSkillLoader {
    name: String,
    root_path: PathBuf,
    loaded_paths: Mutex<Vec<PathBuf>>,
}

impl ManifestSkillLoader {
    pub fn new(name: impl Into<String>, root_path: PathBuf) -> Self {
        Self {
            name: name.into(),
            root_path,
            loaded_paths: Mutex::new(Vec::new()),
        }
    }

    pub fn load_sync(&self) -> Result<(), String> {
        if !self.root_path.is_dir() {
            return Err(format!(
                "Skill loader root is missing or not a directory: {}",
                self.root_path.display()
            ));
        }

        let mut paths = self
            .loaded_paths
            .lock()
            .map_err(|err| format!("Skill loader path lock poisoned: {err}"))?;
        *paths = vec![self.root_path.clone()];
        Ok(())
    }
}

#[async_trait]
impl SkillLoader for ManifestSkillLoader {
    fn name(&self) -> &str {
        &self.name
    }

    fn root_path(&self) -> &Path {
        &self.root_path
    }

    fn search_paths(&self) -> Vec<PathBuf> {
        self.loaded_paths
            .lock()
            .map(|paths| paths.clone())
            .unwrap_or_else(|err| panic!("Skill loader path lock poisoned: {err}"))
    }

    async fn load(&self) -> Result<(), String> {
        self.load_sync()
    }
}
