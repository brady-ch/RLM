use std::fs;
use std::io;
use std::path::{Path, PathBuf};

use serde_json::{json, Map, Value};

use super::paths::ProjectPaths;

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

fn parse_yaml_file(path: &Path) -> io::Result<Value> {
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

fn is_plain_record(value: &Value) -> bool {
    value.is_object()
}

pub fn merge_yaml_layers(left: Value, right: Value) -> Value {
    let mut left_map = match left {
        Value::Object(map) => map,
        _ => Map::new(),
    };
    let Value::Object(right_map) = right else {
        return right;
    };

    for (key, incoming) in right_map {
        if !incoming.is_object() {
            left_map.insert(key, incoming);
            continue;
        }

        let existing = left_map.get(&key).cloned();
        match key.as_str() {
            "agents" => {
                let mut merged = existing
                    .and_then(|value| value.as_object().cloned())
                    .unwrap_or_default();
                merged.extend(incoming.as_object().cloned().unwrap_or_default());
                left_map.insert(key, Value::Object(merged));
            }
            "models" => {
                let prior = existing
                    .and_then(|value| value.as_object().cloned())
                    .unwrap_or_default();
                let incoming_models = incoming.as_object().cloned().unwrap_or_default();
                let left_tiers = prior
                    .get("tiers")
                    .and_then(Value::as_object)
                    .cloned()
                    .unwrap_or_default();
                let right_tiers = incoming_models
                    .get("tiers")
                    .and_then(Value::as_object)
                    .cloned()
                    .unwrap_or_default();
                let left_sampling = prior
                    .get("sampling")
                    .and_then(Value::as_object)
                    .cloned()
                    .unwrap_or_default();
                let right_sampling = incoming_models
                    .get("sampling")
                    .and_then(Value::as_object)
                    .cloned()
                    .unwrap_or_default();
                let left_profiles = left_sampling
                    .get("modelProfiles")
                    .and_then(Value::as_object)
                    .cloned()
                    .unwrap_or_default();
                let right_profiles = right_sampling
                    .get("modelProfiles")
                    .and_then(Value::as_object)
                    .cloned()
                    .unwrap_or_default();
                let mut incoming_without = incoming_models.clone();
                incoming_without.remove("tiers");
                incoming_without.remove("sampling");
                let mut merged_models = prior;
                merged_models.extend(incoming_without);
                let mut merged_sampling = left_sampling.clone();
                merged_sampling.extend(right_sampling);
                let mut profiles = left_profiles;
                profiles.extend(right_profiles);
                merged_sampling.insert("modelProfiles".into(), Value::Object(profiles));
                merged_models.insert(
                    "tiers".into(),
                    Value::Object(left_tiers.into_iter().chain(right_tiers).collect()),
                );
                merged_models.insert("sampling".into(), Value::Object(merged_sampling));
                left_map.insert(key, Value::Object(merged_models));
            }
            "memory" | "runtime" => {
                let mut prior = existing
                    .and_then(|value| value.as_object().cloned())
                    .unwrap_or_default();
                prior.extend(incoming.as_object().cloned().unwrap_or_default());
                left_map.insert(key, Value::Object(prior));
            }
            "workflows" | "hosts" => {
                let mut prior = existing
                    .and_then(|value| value.as_object().cloned())
                    .unwrap_or_default();
                prior.extend(incoming.as_object().cloned().unwrap_or_default());
                left_map.insert(key, Value::Object(prior));
            }
            "interop" => {
                left_map.insert(
                    key,
                    merge_interop(existing.unwrap_or(Value::Null), incoming),
                );
            }
            _ => {
                left_map.insert(key, incoming);
            }
        }
    }

    Value::Object(left_map)
}

fn merge_interop(left: Value, right: Value) -> Value {
    let left_map = left.as_object().cloned().unwrap_or_default();
    let right_map = right.as_object().cloned().unwrap_or_default();
    let lmcp = left_map
        .get("mcp")
        .and_then(Value::as_object)
        .cloned()
        .unwrap_or_default();
    let rmcp = right_map
        .get("mcp")
        .and_then(Value::as_object)
        .cloned()
        .unwrap_or_default();
    let lskills = left_map
        .get("skills")
        .and_then(Value::as_object)
        .cloned()
        .unwrap_or_default();
    let rskills = right_map
        .get("skills")
        .and_then(Value::as_object)
        .cloned()
        .unwrap_or_default();
    let mut merged = left_map;
    merged.extend(right_map);
    merged.insert(
        "mcp".into(),
        Value::Object(lmcp.into_iter().chain(rmcp).collect()),
    );
    merged.insert(
        "skills".into(),
        Value::Object(lskills.into_iter().chain(rskills).collect()),
    );
    Value::Object(merged)
}

fn validate_config_shape(config: &Value) -> io::Result<()> {
    let required = [
        "models",
        "memory",
        "runtime",
        "agents",
        "workflows",
        "interop",
        "hosts",
    ];
    let object = config.as_object().ok_or_else(|| {
        io::Error::new(
            io::ErrorKind::InvalidData,
            "expected config mapping at root",
        )
    })?;
    for key in required {
        if !object.contains_key(key) {
            return Err(io::Error::new(
                io::ErrorKind::InvalidData,
                format!("missing required config section: {key}"),
            ));
        }
    }
    Ok(())
}

fn validate_config_references(config: &Value) -> io::Result<()> {
    let tiers = config
        .pointer("/models/tiers")
        .and_then(Value::as_object)
        .cloned()
        .unwrap_or_default();
    if let Some(agents) = config.get("agents").and_then(Value::as_object) {
        for (agent_id, agent) in agents {
            if let Some(models) = agent.get("models").and_then(Value::as_object) {
                for (purpose, selection) in models {
                    let selection = selection.as_str().unwrap_or("");
                    if selection != "dynamic"
                        && !tiers.contains_key(selection)
                        && !selection.trim().is_empty()
                    {
                        return Err(io::Error::new(
                            io::ErrorKind::InvalidData,
                            format!(
                                "Agent \"{agent_id}\" has invalid model selection for {purpose}: {selection}"
                            ),
                        ));
                    }
                }
            }
        }
    }

    if let Some(workflows) = config.get("workflows").and_then(Value::as_object) {
        for (workflow_id, workflow) in workflows {
            if workflow.get("mode").and_then(Value::as_str) == Some("graph") {
                continue;
            }
            if let Some(agent_ids) = workflow.get("agents").and_then(Value::as_array) {
                for agent_id in agent_ids {
                    let agent_id = agent_id.as_str().unwrap_or("");
                    if !config
                        .pointer("/agents")
                        .and_then(Value::as_object)
                        .is_some_and(|agents| agents.contains_key(agent_id))
                    {
                        return Err(io::Error::new(
                            io::ErrorKind::InvalidData,
                            format!(
                                "Workflow \"{workflow_id}\" references unknown agent \"{agent_id}\"."
                            ),
                        ));
                    }
                }
            }
            if let Some(qa_agent) = workflow.pointer("/qa/agent").and_then(Value::as_str) {
                if !config
                    .pointer("/agents")
                    .and_then(Value::as_object)
                    .is_some_and(|agents| agents.contains_key(qa_agent))
                {
                    return Err(io::Error::new(
                        io::ErrorKind::InvalidData,
                        format!(
                            "Workflow \"{workflow_id}\" references unknown QA agent \"{qa_agent}\"."
                        ),
                    ));
                }
            }
        }
    }
    Ok(())
}

fn default_project_plain() -> Value {
    include_str!("../../../../tests/fixtures/persistence/default-project-config.json")
        .parse()
        .expect("default project config fixture")
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
