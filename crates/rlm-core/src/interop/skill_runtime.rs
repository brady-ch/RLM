use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};

use async_trait::async_trait;
use serde_json::Value;

use crate::application::execution::{
    create_runtime_event, runtime_event_occurred_at_now, NoopRuntimeEventSink, RuntimeEvent,
    RuntimeEventInput, RuntimeEventSeverity, RuntimeEventSink,
};
use crate::plugins::tool_schemas;
use crate::ports::Tool;
use crate::ports::ToolExecutionResult;

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum SkillPathStrictness {
    Strict,
    Lenient,
}

#[derive(Debug, Clone)]
pub struct SkillPathPolicy {
    pub path: PathBuf,
    pub strictness: SkillPathStrictness,
}

#[derive(Debug, Clone)]
pub struct SkillInteropConfig {
    pub search_paths: Vec<PathBuf>,
    pub cache: bool,
    pub path_policies: Vec<SkillPathPolicy>,
}

impl Default for SkillInteropConfig {
    fn default() -> Self {
        Self {
            search_paths: vec![
                PathBuf::from(".codex/skills"),
                PathBuf::from(".agents/skills"),
            ],
            cache: false,
            path_policies: Vec::new(),
        }
    }
}

#[derive(Debug, Clone)]
pub struct SkillCandidate {
    pub name: String,
    pub absolute_path: PathBuf,
    pub valid: bool,
    pub reason: Option<String>,
}

#[derive(Debug)]
pub struct ResolvedSkill {
    pub candidate: SkillCandidate,
    pub warnings: Vec<RuntimeEvent>,
}

pub struct SkillRuntime {
    config: SkillInteropConfig,
    cache: Mutex<HashMap<String, String>>,
    event_sink: Arc<dyn RuntimeEventSink>,
    run_id: String,
    seq: Mutex<u64>,
}

impl SkillRuntime {
    pub fn new(config: SkillInteropConfig) -> Self {
        Self::with_event_sink(config, Arc::new(NoopRuntimeEventSink), "")
    }

    pub fn with_event_sink(
        config: SkillInteropConfig,
        event_sink: Arc<dyn RuntimeEventSink>,
        run_id: impl Into<String>,
    ) -> Self {
        Self {
            config,
            cache: Mutex::new(HashMap::new()),
            event_sink,
            run_id: run_id.into(),
            seq: Mutex::new(0),
        }
    }

    pub fn config(&self) -> &SkillInteropConfig {
        &self.config
    }

    pub fn is_cache_enabled(&self) -> bool {
        self.config.cache
    }

    pub fn resolve_skill(
        &self,
        name: &str,
        candidates: &[SkillCandidate],
    ) -> Result<Option<ResolvedSkill>, String> {
        let mut warnings = Vec::new();
        let ordered = order_candidates_by_path(candidates, &self.config.search_paths);

        for candidate in ordered {
            if candidate.name != name {
                continue;
            }

            let strictness = self.strictness_for_path(&candidate.absolute_path);
            if !candidate.valid {
                let message = candidate
                    .reason
                    .clone()
                    .unwrap_or_else(|| format!("Invalid skill candidate for {name}"));
                let severity = match strictness {
                    SkillPathStrictness::Strict => RuntimeEventSeverity::Error,
                    SkillPathStrictness::Lenient => RuntimeEventSeverity::Warn,
                };
                let seq = {
                    let mut counter = self
                        .seq
                        .lock()
                        .map_err(|err| format!("Event sequence lock poisoned: {err}"))?;
                    *counter += 1;
                    *counter
                };
                let subject = candidate.absolute_path.display().to_string();
                let event = create_runtime_event(RuntimeEventInput {
                    run_id: self.run_id.clone(),
                    code: "SKILL_PARSE_ERROR".into(),
                    severity,
                    source: "skills".into(),
                    subject: subject.clone(),
                    occurred_at: runtime_event_occurred_at_now(),
                    seq,
                    message: message.clone(),
                    metrics: None,
                });
                self.event_sink.emit(event.clone())?;
                warnings.push(event);
                if strictness == SkillPathStrictness::Strict {
                    return Err(format!("Skill parse error at {subject}: {message}"));
                }
                continue;
            }

            return Ok(Some(ResolvedSkill {
                candidate,
                warnings,
            }));
        }

        Ok(None)
    }

    pub fn read_skill_content(&self, candidate: &SkillCandidate) -> Result<String, String> {
        if self.config.cache {
            if let Ok(cache) = self.cache.lock() {
                if let Some(content) = cache.get(&candidate.absolute_path.display().to_string()) {
                    return Ok(content.clone());
                }
            }
        }

        let content = fs::read_to_string(&candidate.absolute_path).map_err(|err| {
            format!(
                "Failed to read skill {}: {err}",
                candidate.absolute_path.display()
            )
        })?;

        if self.config.cache {
            if let Ok(mut cache) = self.cache.lock() {
                cache.insert(
                    candidate.absolute_path.display().to_string(),
                    content.clone(),
                );
            }
        }

        Ok(content)
    }

    fn strictness_for_path(&self, path: &Path) -> SkillPathStrictness {
        for policy in &self.config.path_policies {
            if path.starts_with(&policy.path) {
                return policy.strictness.clone();
            }
        }
        SkillPathStrictness::Strict
    }
}

pub fn parse_skill_config(config: Option<&Value>, project_root: &Path) -> SkillInteropConfig {
    let Some(skills) = config
        .and_then(|value| value.pointer("/interop/skills"))
        .and_then(Value::as_object)
    else {
        return default_skill_config(project_root);
    };

    let search_paths = skills
        .get("searchPaths")
        .and_then(Value::as_array)
        .map(|items| {
            items
                .iter()
                .filter_map(Value::as_str)
                .map(|path| resolve_config_path(project_root, path))
                .collect::<Vec<_>>()
        })
        .unwrap_or_else(|| default_skill_config(project_root).search_paths.clone());

    let cache = skills
        .get("cache")
        .and_then(Value::as_bool)
        .unwrap_or(false);

    let path_policies = skills
        .get("pathPolicies")
        .and_then(Value::as_array)
        .map(|items| {
            items
                .iter()
                .filter_map(|policy| {
                    let path = policy.get("path")?.as_str()?;
                    let strictness = policy
                        .get("strictness")
                        .and_then(Value::as_str)
                        .map(|value| match value {
                            "lenient" => SkillPathStrictness::Lenient,
                            _ => SkillPathStrictness::Strict,
                        })
                        .unwrap_or(SkillPathStrictness::Strict);
                    Some(SkillPathPolicy {
                        path: resolve_config_path(project_root, path),
                        strictness,
                    })
                })
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();

    SkillInteropConfig {
        search_paths,
        cache,
        path_policies,
    }
}

fn default_skill_config(project_root: &Path) -> SkillInteropConfig {
    let defaults = SkillInteropConfig::default();
    SkillInteropConfig {
        search_paths: defaults
            .search_paths
            .iter()
            .map(|path| resolve_config_path(project_root, &path.display().to_string()))
            .collect(),
        ..defaults
    }
}

pub fn resolve_config_path(project_root: &Path, path: &str) -> PathBuf {
    let candidate = PathBuf::from(path);
    if candidate.is_absolute() {
        candidate
    } else {
        project_root.join(candidate)
    }
}

pub fn discover_skill_candidates(search_paths: &[PathBuf]) -> Vec<SkillCandidate> {
    let mut candidates = Vec::new();
    for search_path in search_paths {
        if !search_path.is_dir() {
            continue;
        }
        let entries = match fs::read_dir(search_path) {
            Ok(entries) => entries,
            Err(_) => continue,
        };
        for entry in entries.flatten() {
            let path = entry.path();
            let skill_path = if path.is_dir() {
                path.join("SKILL.md")
            } else if path.extension().and_then(|ext| ext.to_str()) == Some("md") {
                path
            } else {
                continue;
            };
            if !skill_path.is_file() {
                continue;
            }
            if let Ok(candidate) = to_skill_candidate(&skill_path) {
                candidates.push(candidate);
            }
        }
    }
    candidates
}

fn to_skill_candidate(path: &Path) -> Result<SkillCandidate, String> {
    let content = fs::read_to_string(path)
        .map_err(|err| format!("Failed to read {}: {err}", path.display()))?;
    let frontmatter = extract_frontmatter(&content);
    let name = frontmatter
        .as_ref()
        .and_then(|body| parse_frontmatter_name(body))
        .unwrap_or_else(|| {
            path.parent()
                .and_then(|parent| parent.file_name())
                .and_then(|name| name.to_str())
                .unwrap_or("skill")
                .to_string()
        });
    let valid = frontmatter.is_some() && !name.is_empty();
    Ok(SkillCandidate {
        name,
        absolute_path: path.canonicalize().unwrap_or_else(|_| path.to_path_buf()),
        valid,
        reason: if valid {
            None
        } else {
            Some("missing frontmatter".into())
        },
    })
}

fn extract_frontmatter(content: &str) -> Option<String> {
    let rest = content.strip_prefix("---\n")?;
    let end = rest.find("\n---")?;
    Some(rest[..end].to_string())
}

fn parse_frontmatter_name(body: &str) -> Option<String> {
    for line in body.lines() {
        let trimmed = line.trim();
        let Some(value) = trimmed.strip_prefix("name:") else {
            continue;
        };
        let value = value.trim().trim_matches(['"', '\''].as_ref());
        if !value.is_empty() {
            return Some(value.to_string());
        }
    }
    None
}

fn order_candidates_by_path(
    candidates: &[SkillCandidate],
    search_paths: &[PathBuf],
) -> Vec<SkillCandidate> {
    let mut ordered = Vec::new();
    for prefix in search_paths {
        for candidate in candidates {
            if candidate.absolute_path.starts_with(prefix)
                && !ordered
                    .iter()
                    .any(|item: &SkillCandidate| item.absolute_path == candidate.absolute_path)
            {
                ordered.push(candidate.clone());
            }
        }
    }
    for candidate in candidates {
        if !ordered
            .iter()
            .any(|item| item.absolute_path == candidate.absolute_path)
        {
            ordered.push(candidate.clone());
        }
    }
    ordered
}

struct SkillTool {
    runtime: Arc<SkillRuntime>,
}

pub fn create_skill_tool(runtime: Arc<SkillRuntime>) -> Arc<dyn Tool> {
    Arc::new(SkillTool { runtime })
}

#[async_trait]
impl Tool for SkillTool {
    fn name(&self) -> &str {
        "skill"
    }

    fn description(&self) -> &str {
        "Load an on-disk skill by name from the configured skill search paths."
    }

    fn schema(&self) -> serde_json::Value {
        tool_schemas::skill_schema()
    }

    async fn execute(&self, arguments: Value) -> ToolExecutionResult {
        let name = arguments
            .get("name")
            .and_then(Value::as_str)
            .unwrap_or("")
            .trim();
        if name.is_empty() {
            return ToolExecutionResult {
                content: "Skill name is required.".into(),
                is_error: true,
            };
        }

        let candidates = discover_skill_candidates(&self.runtime.config.search_paths);
        let resolved = match self.runtime.resolve_skill(name, &candidates) {
            Ok(Some(resolved)) => resolved,
            Ok(None) => {
                return ToolExecutionResult {
                    content: format!("Unknown skill: {name}"),
                    is_error: true,
                };
            }
            Err(err) => {
                return ToolExecutionResult {
                    content: err,
                    is_error: true,
                };
            }
        };

        match self.runtime.read_skill_content(&resolved.candidate) {
            Ok(content) => ToolExecutionResult {
                content,
                is_error: false,
            },
            Err(err) => ToolExecutionResult {
                content: err,
                is_error: true,
            },
        }
    }
}

pub fn validate_skill_search_paths(config: &SkillInteropConfig) -> Vec<String> {
    config
        .search_paths
        .iter()
        .filter(|path| !path.is_dir())
        .map(|path| {
            format!(
                "Configured skill search path does not exist or is not a directory: {}",
                path.display()
            )
        })
        .collect()
}

pub struct SkillInteropResult {
    pub tool: Arc<dyn Tool>,
    pub warnings: Vec<String>,
}

pub fn load_skill_interop(
    project_config: Option<&Value>,
    project_root: &Path,
    extension_host: &mut crate::plugins::extension_host::ExtensionHost,
) -> Result<SkillInteropResult, String> {
    let mut skill_config = parse_skill_config(project_config, project_root);
    merge_manifest_loader_search_paths(extension_host, &mut skill_config.search_paths);
    let warnings = validate_skill_search_paths(&skill_config);
    let runtime = Arc::new(SkillRuntime::new(skill_config));
    let tool = create_skill_tool(Arc::clone(&runtime));
    extension_host
        .register_tool(Arc::clone(&tool))
        .map_err(|err| format!("Failed to register skill tool: {err}"))?;
    Ok(SkillInteropResult { tool, warnings })
}

fn merge_manifest_loader_search_paths(
    extension_host: &crate::plugins::extension_host::ExtensionHost,
    search_paths: &mut Vec<PathBuf>,
) {
    for name in extension_host.skill_loader_names() {
        let Some(loader) = extension_host.get_skill_loader(&name) else {
            continue;
        };
        for path in loader.search_paths() {
            if !search_paths.iter().any(|existing| existing == &path) {
                search_paths.push(path);
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::application::execution::RuntimeEventSeverity;
    use std::fs;
    use tempfile::tempdir;

    #[test]
    fn resolve_skill_prefers_search_path_order_and_lenient_warnings() {
        let runtime = SkillRuntime::new(SkillInteropConfig {
            search_paths: vec![PathBuf::from("/a"), PathBuf::from("/b")],
            cache: false,
            path_policies: vec![SkillPathPolicy {
                path: PathBuf::from("/a"),
                strictness: SkillPathStrictness::Lenient,
            }],
        });

        let resolved = runtime
            .resolve_skill(
                "narrate",
                &[
                    SkillCandidate {
                        name: "narrate".into(),
                        absolute_path: PathBuf::from("/a/narrate/SKILL.md"),
                        valid: false,
                        reason: Some("bad format".into()),
                    },
                    SkillCandidate {
                        name: "narrate".into(),
                        absolute_path: PathBuf::from("/b/narrate/SKILL.md"),
                        valid: true,
                        reason: None,
                    },
                ],
            )
            .expect("resolve")
            .expect("found");

        assert_eq!(
            resolved.candidate.absolute_path,
            PathBuf::from("/b/narrate/SKILL.md")
        );
        assert_eq!(resolved.warnings.len(), 1);
        assert_eq!(resolved.warnings[0].code, "SKILL_PARSE_ERROR");
        assert_eq!(resolved.warnings[0].severity, RuntimeEventSeverity::Warn);
    }

    #[test]
    fn strict_policy_rejects_invalid_skill() {
        let runtime = SkillRuntime::new(SkillInteropConfig {
            search_paths: vec![PathBuf::from("/strict")],
            cache: false,
            path_policies: vec![SkillPathPolicy {
                path: PathBuf::from("/strict"),
                strictness: SkillPathStrictness::Strict,
            }],
        });

        let err = runtime
            .resolve_skill(
                "parse",
                &[SkillCandidate {
                    name: "parse".into(),
                    absolute_path: PathBuf::from("/strict/parse/SKILL.md"),
                    valid: false,
                    reason: None,
                }],
            )
            .expect_err("strict path should fail");
        assert!(err.contains("Skill parse error"));
    }

    #[test]
    fn skill_tool_loads_fixture_skill() {
        let dir = tempdir().expect("tempdir");
        let skill_dir = dir.path().join("summarize");
        fs::create_dir_all(&skill_dir).expect("mkdir");
        fs::write(
            skill_dir.join("SKILL.md"),
            "---\nname: summarize\ndescription: Summarize text\n---\nUse terse bullets.\n",
        )
        .expect("write skill");

        let runtime = Arc::new(SkillRuntime::new(SkillInteropConfig {
            search_paths: vec![dir.path().to_path_buf()],
            cache: false,
            path_policies: vec![SkillPathPolicy {
                path: dir.path().to_path_buf(),
                strictness: SkillPathStrictness::Strict,
            }],
        }));
        let tool = create_skill_tool(runtime);
        let result = block_on_async(tool.execute(serde_json::json!({ "name": "summarize" })));
        assert!(!result.is_error);
        assert!(result.content.contains("Use terse bullets"));
    }

    fn block_on_async<F: std::future::Future>(future: F) -> F::Output {
        if let Ok(handle) = tokio::runtime::Handle::try_current() {
            return handle.block_on(future);
        }
        let runtime = tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .expect("runtime");
        runtime.block_on(future)
    }
}
