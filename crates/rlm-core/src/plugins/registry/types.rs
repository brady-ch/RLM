use serde::Serialize;

use super::super::manifest::PluginManifest;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum PluginListSource {
    Builtin,
    Local,
    Configured,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PluginListItem {
    pub id: String,
    pub name: String,
    pub version: String,
    pub category: String,
    pub source: PluginListSource,
    pub enabled: bool,
    pub path: String,
    pub tools: Vec<String>,
    pub skill_loaders: Vec<String>,
    pub model_hosts: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct PluginMutationResult {
    pub ok: bool,
    pub id: String,
    pub requires_restart: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PluginInstallRemotePreview {
    pub ok: bool,
    pub needs_confirm: bool,
    pub id: String,
    pub source: String,
    pub manifest: PluginManifest,
}

#[derive(Debug, Clone, Serialize)]
pub struct PluginDoctorIssue {
    pub code: String,
    pub severity: String,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub plugin_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub path: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct PluginDoctorResult {
    pub ok: bool,
    pub issues: Vec<PluginDoctorIssue>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub fixes_applied: Option<Vec<String>>,
}
