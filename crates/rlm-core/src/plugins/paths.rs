use std::path::{Path, PathBuf};

pub fn user_plugins_root() -> PathBuf {
    dirs::home_dir()
        .map(|home| home.join(".rlm").join("plugins"))
        .unwrap_or_else(|| PathBuf::from(".rlm/plugins"))
}

pub fn user_plugin_catalog_path() -> PathBuf {
    user_plugins_root().join("catalog.json")
}

pub fn user_plugin_install_dir(plugin_id: &str) -> PathBuf {
    user_plugins_root().join(plugin_id)
}

pub fn project_plugin_catalog_path(project_root: &Path) -> PathBuf {
    project_root
        .join(".rlm")
        .join("plugins")
        .join("catalog.json")
}
