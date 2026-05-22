use serde::{Deserialize, Serialize};
use std::path::Path;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "camelCase")]
pub struct PluginContributes {
    #[serde(default)]
    pub tools: Vec<String>,
    #[serde(default)]
    pub skill_loaders: Vec<String>,
    #[serde(default)]
    pub model_hosts: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct PluginEngines {
    pub rlm: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct PluginManifest {
    pub id: String,
    pub name: String,
    pub version: String,
    pub category: String,
    #[serde(default)]
    pub contributes: PluginContributes,
    pub engines: PluginEngines,
}
pub fn parse_plugin_manifest(raw: &str, context: &str) -> Result<PluginManifest, String> {
    let parsed: serde_json::Value = serde_json::from_str(raw)
        .map_err(|err| format!("Plugin manifest at {context} is not valid JSON: {err}"))?;
    validate_manifest_value(&parsed, context)
}

pub fn read_and_validate_plugin_manifest(manifest_path: &Path) -> Result<PluginManifest, String> {
    let raw = std::fs::read_to_string(manifest_path).map_err(|err| {
        format!(
            "Failed to read plugin manifest at {}: {err}",
            manifest_path.display()
        )
    })?;
    parse_plugin_manifest(&raw, &manifest_path.display().to_string())
}

fn validate_manifest_value(
    value: &serde_json::Value,
    context: &str,
) -> Result<PluginManifest, String> {
    let id = required_string(value, "id")?;
    if id.is_empty() {
        return Err(format!(
            "Invalid plugin manifest at {context}: id: Required"
        ));
    }
    let name = required_string(value, "name")?;
    if name.is_empty() {
        return Err(format!(
            "Invalid plugin manifest at {context}: name: Required"
        ));
    }
    let version = required_string(value, "version")?;
    if version.is_empty() {
        return Err(format!(
            "Invalid plugin manifest at {context}: version: Required"
        ));
    }
    let category = required_string(value, "category")?;
    if category.is_empty() {
        return Err(format!(
            "Invalid plugin manifest at {context}: category: Required"
        ));
    }
    let engines = value
        .get("engines")
        .ok_or_else(|| format!("Invalid plugin manifest at {context}: engines: Required"))?;
    let rlm = required_string(engines, "rlm")?;
    if rlm.is_empty() {
        return Err(format!(
            "Invalid plugin manifest at {context}: engines.rlm: Required"
        ));
    }

    let contributes = value.get("contributes").cloned().unwrap_or_default();
    let tools = string_array(&contributes, "tools");
    let skill_loaders = string_array(&contributes, "skillLoaders");
    let model_hosts = string_array(&contributes, "modelHosts");

    Ok(PluginManifest {
        id,
        name,
        version,
        category,
        contributes: PluginContributes {
            tools,
            skill_loaders,
            model_hosts,
        },
        engines: PluginEngines { rlm },
    })
}

fn required_string(value: &serde_json::Value, key: &str) -> Result<String, String> {
    value
        .get(key)
        .and_then(|v| v.as_str())
        .map(str::to_string)
        .ok_or_else(|| format!("{key}: Required"))
}

fn string_array(value: &serde_json::Value, key: &str) -> Vec<String> {
    value
        .get(key)
        .and_then(|v| v.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|v| v.as_str().map(str::to_string))
                .filter(|s| !s.is_empty())
                .collect()
        })
        .unwrap_or_default()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn validates_minimal_manifest() {
        let raw = r#"{
            "id": "demo.test",
            "name": "Demo",
            "version": "1.0.0",
            "category": "shell",
            "engines": { "rlm": ">=1.0.0" }
        }"#;
        let manifest = parse_plugin_manifest(raw, "test").expect("valid");
        assert_eq!(manifest.id, "demo.test");
        assert!(manifest.contributes.tools.is_empty());
    }

    #[test]
    fn rejects_missing_id() {
        let raw = r#"{ "name": "Demo", "version": "1.0.0", "category": "shell", "engines": { "rlm": ">=1.0.0" } }"#;
        assert!(parse_plugin_manifest(raw, "test").is_err());
    }
}
