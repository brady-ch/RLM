use std::fs;
use std::io;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::domain::types::{ExecutionGraph, ExecutionGraphNode, ExecutionStatus, SessionSnapshot};

pub const GRAPH_WORKFLOW_SCHEMA_VERSION: i32 = 1;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GraphWorkflowSidecar {
    pub kind: String,
    pub schema_version: i32,
    pub graph_id: String,
    pub updated_at: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    pub variants: Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GraphWorkflowListEntry {
    pub id: String,
    pub path: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    pub updated_at: String,
    pub variants: Vec<String>,
}

pub fn workflows_dir(project_root: &Path) -> PathBuf {
    project_root.join(".rlm/workflows")
}

pub fn workflow_path(project_root: &Path, workflow_id: &str) -> PathBuf {
    workflows_dir(project_root).join(format!("{workflow_id}.yaml"))
}

pub fn list_graph_workflows(project_root: &Path) -> io::Result<Vec<GraphWorkflowListEntry>> {
    let dir = workflows_dir(project_root);
    let mut entries = match fs::read_dir(&dir) {
        Ok(read) => read
            .filter_map(|e| e.ok())
            .map(|e| e.path())
            .filter(|p| {
                p.extension()
                    .and_then(|ext| ext.to_str())
                    .is_some_and(|ext| ext == "yaml" || ext == "yml")
            })
            .collect::<Vec<_>>(),
        Err(err) if err.kind() == io::ErrorKind::NotFound => return Ok(vec![]),
        Err(err) => return Err(err),
    };
    entries.sort_by(|a, b| a.file_name().cmp(&b.file_name()));

    let mut workflows = Vec::new();
    for path in entries {
        let file_name = path.file_name().and_then(|n| n.to_str()).unwrap_or("");
        let id = file_name.trim_end_matches(".yaml").trim_end_matches(".yml");
        if let Ok(sidecar) = load_sidecar_from_path(&path) {
            let mut variants = Vec::new();
            if sidecar.variants.get("playbook").is_some() {
                variants.push("playbook".into());
            }
            if sidecar.variants.get("pipeline").is_some() {
                variants.push("pipeline".into());
            }
            workflows.push(GraphWorkflowListEntry {
                id: if sidecar.graph_id.is_empty() {
                    id.to_string()
                } else {
                    sidecar.graph_id.clone()
                },
                path: format!(".rlm/workflows/{file_name}"),
                description: sidecar.description.clone(),
                updated_at: sidecar.updated_at.clone(),
                variants,
            });
        }
    }
    Ok(workflows)
}

pub fn load_graph_workflow(
    project_root: &Path,
    workflow_id: &str,
) -> io::Result<GraphWorkflowSidecar> {
    load_sidecar_from_path(&workflow_path(project_root, workflow_id))
}

fn load_sidecar_from_path(path: &Path) -> io::Result<GraphWorkflowSidecar> {
    let raw = fs::read_to_string(path)?;
    let value: Value = serde_yaml::from_str(&raw)
        .map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e.to_string()))?;
    parse_sidecar(&value).map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e))
}

pub fn export_and_save_graph_workflow(
    project_root: &Path,
    workflow_id: &str,
    description: Option<String>,
    variant: &str,
    graph: &ExecutionGraph,
) -> io::Result<(PathBuf, GraphWorkflowSidecar)> {
    if graph.nodes.is_empty() {
        return Err(io::Error::new(
            io::ErrorKind::InvalidInput,
            "Cannot export an empty graph.",
        ));
    }
    let serialized = serialize_graph(graph);
    let mut variants = serde_json::Map::new();
    if variant == "playbook" || variant == "both" {
        variants.insert(
            "playbook".into(),
            serde_json::json!({ "graph": serialized }),
        );
    }
    if variant == "pipeline" || variant == "both" {
        variants.insert(
            "pipeline".into(),
            serde_json::json!({ "graph": serialized }),
        );
    }
    let sidecar = GraphWorkflowSidecar {
        kind: "graph".into(),
        schema_version: GRAPH_WORKFLOW_SCHEMA_VERSION,
        graph_id: workflow_id.to_string(),
        updated_at: iso_now(),
        description,
        variants: Value::Object(variants),
    };
    let dir = workflows_dir(project_root);
    fs::create_dir_all(&dir)?;
    let path = workflow_path(project_root, workflow_id);
    let yaml = serde_yaml::to_string(&sidecar_to_yaml_value(&sidecar))
        .map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e.to_string()))?;
    fs::write(&path, yaml)?;
    Ok((path, sidecar))
}

pub fn import_sidecar_to_graph(
    sidecar: &GraphWorkflowSidecar,
    variant: &str,
) -> Result<ExecutionGraph, String> {
    let graph_value = sidecar
        .variants
        .get(variant)
        .and_then(|v| v.get("graph"))
        .ok_or_else(|| format!("Missing {variant} variant in sidecar."))?;
    deserialize_graph(graph_value)
}

pub fn build_import_session_snapshot(graph: ExecutionGraph) -> SessionSnapshot {
    SessionSnapshot {
        graph,
        status: ExecutionStatus::Planned,
        active_node_id: None,
        approval_mode: Default::default(),
        auto_approval_paused: false,
        run_summary: None,
        chat: crate::domain::types::ChatSnapshot {
            readiness: crate::domain::types::ChatReadiness::Structured {
                state: "draft".into(),
                reason: "Imported workflow graph.".into(),
            },
            pending_mutation: None,
            pending_clarification: None,
            clarification_history: vec![],
        },
    }
}

fn serialize_graph(graph: &ExecutionGraph) -> Value {
    serde_json::to_value(graph).unwrap_or(Value::Null)
}

fn deserialize_graph(value: &Value) -> Result<ExecutionGraph, String> {
    serde_json::from_value(value.clone()).map_err(|e| e.to_string())
}

fn parse_sidecar(value: &Value) -> Result<GraphWorkflowSidecar, String> {
    if value.get("kind").and_then(|k| k.as_str()) != Some("graph") {
        return Err("Sidecar kind must be \"graph\".".into());
    }
    Ok(GraphWorkflowSidecar {
        kind: "graph".into(),
        schema_version: value
            .get("schemaVersion")
            .and_then(|v| v.as_i64())
            .unwrap_or(1) as i32,
        graph_id: value
            .get("graphId")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string(),
        updated_at: value
            .get("updatedAt")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string(),
        description: value
            .get("description")
            .and_then(|v| v.as_str())
            .map(String::from),
        variants: value
            .get("variants")
            .cloned()
            .unwrap_or(Value::Object(Default::default())),
    })
}

fn sidecar_to_yaml_value(sidecar: &GraphWorkflowSidecar) -> Value {
    serde_json::json!({
        "kind": sidecar.kind,
        "schemaVersion": sidecar.schema_version,
        "graphId": sidecar.graph_id,
        "updatedAt": sidecar.updated_at,
        "description": sidecar.description,
        "variants": sidecar.variants,
    })
}

fn iso_now() -> String {
    time::OffsetDateTime::now_utc()
        .format(&time::format_description::well_known::Rfc3339)
        .unwrap_or_else(|_| "1970-01-01T00:00:00Z".to_string())
}

pub fn find_graph_root_node(graph: &ExecutionGraph) -> Option<&ExecutionGraphNode> {
    let roots: Vec<_> = graph.nodes.iter().filter(|node| node.parent_id.is_none()).collect();
    roots
        .iter()
        .find(|node| node.id == "root-composer")
        .copied()
        .or_else(|| roots.first().copied())
}

pub fn graph_has_pipeline_template(graph: &ExecutionGraph) -> bool {
    let Some(root) = find_graph_root_node(graph) else {
        return false;
    };
    let prompt = root.prompt.as_deref().unwrap_or(&root.label);
    prompt.contains("{{input}}")
}

pub fn apply_pipeline_template(graph: ExecutionGraph, input: &str) -> Result<ExecutionGraph, String> {
    let Some(root_id) = find_graph_root_node(&graph).map(|node| node.id.clone()) else {
        return Err("Graph has no root node.".into());
    };
    let mut nodes = graph.nodes;
    for node in &mut nodes {
        if node.id != root_id {
            continue;
        }
        let base_prompt = node.prompt.clone().unwrap_or_else(|| node.label.clone());
        let prompt = base_prompt.replace("{{input}}", input);
        node.prompt = Some(prompt.clone());
        node.label = node.label.replace("{{input}}", input);
        if let Some(composer) = node.composer.as_mut() {
            if let Some(obj) = composer.as_object_mut() {
                let composer_prompt = obj
                    .get("prompt")
                    .and_then(|value| value.as_str())
                    .unwrap_or(&base_prompt);
                obj.insert(
                    "prompt".into(),
                    Value::String(composer_prompt.replace("{{input}}", input)),
                );
            }
        }
    }
    Ok(ExecutionGraph {
        nodes,
        edges: graph.edges,
        viewport: graph.viewport,
    })
}
