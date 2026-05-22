use std::fs;
use std::io;
use std::path::{Path, PathBuf};

use serde_json::{json, Map, Value};

use crate::persistence::ProjectPaths;

use super::defaults::default_project_plain;
use super::validation::{validate_config_references, validate_config_shape};
use super::yaml_merge::{is_plain_record, merge_yaml_layers};

#[derive(Debug, Clone)]
pub struct LoadedProjectConfig {
    pub config: Value,
    pub path: Option<PathBuf>,
}

pub fn load_project_config(
    project_root: &Path,
    explicit_path: Option<&Path>,
) -> io::Result<LoadedProjectConfig> {
    if let Some(path) = explicit_path {
        return load_explicit(path);
    }

    let paths = ProjectPaths::from_root(project_root.to_path_buf());
    let mut merged = default_project_plain();

    let global_fragments = dirs::home_dir()
        .map(|home| home.join(".rlm"))
        .unwrap_or_else(|| PathBuf::from(".rlm"));
    if global_fragments.is_dir() {
        merged = merge_yaml_layers(merged, load_scoped_fragments(&global_fragments)?);
    }

    let mut primary_path: Option<PathBuf> = None;
    let legacy_scoped = paths.legacy_config_path();
    let legacy_exists = legacy_scoped.is_file();

    if paths.scoped_dir().is_dir() {
        if legacy_exists {
            let legacy_yaml = parse_yaml_file(&legacy_scoped)?;
            merged = merge_yaml_layers(merged, legacy_yaml);
            primary_path.get_or_insert(legacy_scoped.clone());
        }
        merged = merge_yaml_layers(merged, load_scoped_fragments(&paths.scoped_dir())?);
        let cfg_child = paths.scoped_config_path();
        if cfg_child.is_file() {
            primary_path.get_or_insert(cfg_child);
        }
        if primary_path.is_none() && legacy_exists {
            primary_path = Some(legacy_scoped);
        }
    } else if legacy_exists {
        let parsed = parse_yaml_file(&legacy_scoped)?;
        merged = merge_yaml_layers(merged, parsed);
        primary_path = Some(legacy_scoped);
    } else if let Some(discovered) = find_default_config_path(project_root) {
        let parsed = parse_yaml_file(&discovered)?;
        merged = merge_yaml_layers(merged, parsed);
        primary_path = Some(discovered);
    }

    validate_config_shape(&merged)?;
    validate_config_references(&merged)?;
    Ok(LoadedProjectConfig {
        config: merged,
        path: primary_path,
    })
}

fn load_explicit(path: &Path) -> io::Result<LoadedProjectConfig> {
    let resolved = path.canonicalize().unwrap_or_else(|_| path.to_path_buf());
    let yaml_root = parse_yaml_file(&resolved)?;
    let merged = merge_yaml_layers(default_project_plain(), yaml_root);
    validate_config_shape(&merged)?;
    validate_config_references(&merged)?;
    Ok(LoadedProjectConfig {
        config: merged,
        path: Some(resolved),
    })
}

fn find_default_config_path(project_root: &Path) -> Option<PathBuf> {
    let candidate = project_root.join("rlm.config.yaml");
    candidate.is_file().then_some(candidate)
}

pub(crate) fn parse_yaml_file(path: &Path) -> io::Result<Value> {
    let raw = fs::read_to_string(path)
        .map_err(|err| io::Error::new(err.kind(), format!("{}: {err}", path.display())))?;
    serde_yaml::from_str(&raw).map_err(|err| {
        io::Error::new(
            io::ErrorKind::InvalidData,
            format!("{}: {err}", path.display()),
        )
    })
}

fn load_scoped_fragments(scope_root: &Path) -> io::Result<Value> {
    if !scope_root.is_dir() {
        return Ok(json!({}));
    }

    let mut accumulator = Map::new();
    let cfg_path = scope_root.join("config.yaml");
    if cfg_path.is_file() {
        let yaml_root = parse_yaml_file(&cfg_path)?;
        if !is_plain_record(&yaml_root) {
            return Err(io::Error::new(
                io::ErrorKind::InvalidData,
                format!("{}: expected YAML mapping at root", cfg_path.display()),
            ));
        }
        accumulator = merge_yaml_layers(Value::Object(accumulator), yaml_root)
            .as_object()
            .cloned()
            .unwrap_or_default();
    }

    let agents_dir = scope_root.join("agents");
    if agents_dir.is_dir() {
        let mut agents_partial = Map::new();
        let mut entries: Vec<_> = fs::read_dir(&agents_dir)?
            .flatten()
            .map(|entry| entry.file_name().to_string_lossy().to_string())
            .collect();
        entries.sort();
        for file_name in entries {
            if !(file_name.ends_with(".yaml") || file_name.ends_with(".yml")) {
                continue;
            }
            let agent_id = file_name
                .trim_end_matches(".yaml")
                .trim_end_matches(".yml")
                .trim();
            if agent_id.is_empty() {
                continue;
            }
            let file_path = agents_dir.join(&file_name);
            let agent_doc = parse_yaml_file(&file_path)?;
            if !is_plain_record(&agent_doc) {
                return Err(io::Error::new(
                    io::ErrorKind::InvalidData,
                    format!(
                        "{}: agent fragment must map tools/models",
                        file_path.display()
                    ),
                ));
            }
            agents_partial.insert(agent_id.to_string(), agent_doc);
        }
        if !agents_partial.is_empty() {
            accumulator = merge_yaml_layers(
                Value::Object(accumulator),
                json!({ "agents": agents_partial }),
            )
            .as_object()
            .cloned()
            .unwrap_or_default();
        }
    }

    let models_dir = scope_root.join("models");
    if models_dir.is_dir() {
        let mut tiers = Map::new();
        let mut entries: Vec<_> = fs::read_dir(&models_dir)?
            .flatten()
            .map(|entry| entry.file_name().to_string_lossy().to_string())
            .collect();
        entries.sort();
        for entry_name in entries {
            if !(entry_name.ends_with(".yaml") || entry_name.ends_with(".yml")) {
                continue;
            }
            let tier_key = entry_name
                .trim_end_matches(".yaml")
                .trim_end_matches(".yml")
                .trim();
            if tier_key.is_empty() {
                continue;
            }
            let file_path = models_dir.join(&entry_name);
            let tier_doc = parse_yaml_file(&file_path)?;
            if !is_plain_record(&tier_doc) {
                return Err(io::Error::new(
                    io::ErrorKind::InvalidData,
                    format!("{}: tier fragment must map fields", file_path.display()),
                ));
            }
            tiers.insert(tier_key.to_string(), tier_doc);
        }
        if !tiers.is_empty() {
            accumulator = merge_yaml_layers(
                Value::Object(accumulator),
                json!({ "models": { "tiers": tiers } }),
            )
            .as_object()
            .cloned()
            .unwrap_or_default();
        }
    }

    Ok(Value::Object(accumulator))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn parse_yaml_includes_path_context() {
        let dir = std::env::temp_dir().join(format!("rlm-config-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        let path = dir.join("bad.yaml");
        fs::write(&path, ":\n- not a map\n").unwrap();
        let err = parse_yaml_file(&path).unwrap_err();
        assert!(err.to_string().contains(&path.display().to_string()));
    }
}
