use std::path::PathBuf;

use serde_json::Value;

#[derive(Debug, Clone)]
pub struct PluginRegistryConfig {
    pub project_config: Value,
    pub config_file_path: PathBuf,
}
