use std::path::{Path, PathBuf};

/// Declarative skill loader registered from plugin manifest `skillLoaders`.
pub trait SkillLoader: Send + Sync {
    fn name(&self) -> &str;
    fn root_path(&self) -> &Path;
}

pub struct ManifestSkillLoader {
    name: String,
    root_path: PathBuf,
}

impl ManifestSkillLoader {
    pub fn new(name: impl Into<String>, root_path: PathBuf) -> Self {
        Self {
            name: name.into(),
            root_path,
        }
    }
}

impl SkillLoader for ManifestSkillLoader {
    fn name(&self) -> &str {
        &self.name
    }

    fn root_path(&self) -> &Path {
        &self.root_path
    }
}
