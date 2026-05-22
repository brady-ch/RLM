use std::path::{Path, PathBuf};

#[derive(Debug, Clone)]
pub struct ProjectPaths {
    pub project_root: PathBuf,
    pub sessions_dir: PathBuf,
    pub memory_dir: PathBuf,
    pub run_state_dir: PathBuf,
}

impl ProjectPaths {
    pub fn from_root(project_root: PathBuf) -> Self {
        Self {
            sessions_dir: project_root.join(".rlm").join("sessions"),
            memory_dir: project_root.join(".rlm").join("memory"),
            run_state_dir: project_root.join(".planning").join("runs"),
            project_root,
        }
    }

    pub fn sessions_configured(&self) -> bool {
        self.sessions_dir.is_dir()
    }

    pub fn memory_configured(&self) -> bool {
        self.memory_dir.is_dir()
    }

    pub fn legacy_config_path(&self) -> PathBuf {
        self.project_root.join("rlm.config.yaml")
    }

    pub fn scoped_config_path(&self) -> PathBuf {
        self.project_root.join(".rlm").join("config.yaml")
    }

    pub fn scoped_dir(&self) -> PathBuf {
        self.project_root.join(".rlm")
    }
}

impl From<&Path> for ProjectPaths {
    fn from(project_root: &Path) -> Self {
        Self::from_root(project_root.to_path_buf())
    }
}
