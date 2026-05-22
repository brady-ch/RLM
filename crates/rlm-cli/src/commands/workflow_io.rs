use rlm_core::domain::types::ExecutionGraph;
use rlm_core::{
    default_save_variant, export_and_save_graph_workflow, import_sidecar_to_graph,
    load_graph_workflow,
};
use serde_json::json;

use crate::commands::session::session_store;
use crate::flags::CommandContext;

pub async fn run_export(ctx: &CommandContext) -> Result<(), Box<dyn std::error::Error>> {
    let workflow_id = ctx
        .flags
        .workflow
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .ok_or("workflow-export requires --workflow <id>.")?;
    let session_id = ctx
        .flags
        .export_session
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .ok_or("workflow-export requires --export-session <id>.")?;

    let store = session_store(ctx.project_root.clone());
    let saved = store.load(session_id).map_err(|err| err.to_string())?;
    let session_graph: ExecutionGraph = saved
        .payload
        .session
        .get("graph")
        .and_then(|value| serde_json::from_value(value.clone()).ok())
        .ok_or_else(|| format!("Saved session \"{session_id}\" has no graph to export."))?;
    if session_graph.nodes.is_empty() {
        return Err(format!("Saved session \"{session_id}\" has no graph to export.").into());
    }

    let variant = ctx
        .flags
        .variant
        .as_deref()
        .unwrap_or_else(|| default_save_variant(&session_graph));
    let (path, sidecar) = export_and_save_graph_workflow(
        &ctx.project_root,
        workflow_id,
        ctx.flags.description.clone(),
        variant,
        &session_graph,
    )
    .map_err(|err| err.to_string())?;

    let output = json!({
        "workflowId": workflow_id,
        "path": path.to_string_lossy(),
        "variant": variant,
        "nodeCount": session_graph.nodes.len(),
        "updatedAt": sidecar.updated_at,
    });
    println!("{}", serde_json::to_string_pretty(&output)?);
    Ok(())
}

pub async fn run_import(ctx: &CommandContext) -> Result<(), Box<dyn std::error::Error>> {
    let workflow_id = ctx
        .flags
        .resolved_workflow_id()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .ok_or("workflow-import requires --workflow <id> or --import-workflow <id>.")?;

    let sidecar =
        load_graph_workflow(&ctx.project_root, workflow_id).map_err(|err| err.to_string())?;
    let variant = if ctx.flags.variant.as_deref() == Some("pipeline") {
        "pipeline"
    } else {
        "playbook"
    };
    let graph = import_sidecar_to_graph(&sidecar, variant).map_err(|err| err.to_string())?;
    let expert_nodes: Vec<_> = graph
        .nodes
        .iter()
        .filter(|node| {
            node.expert_agent_id
                .as_deref()
                .is_some_and(|id| id != "default")
        })
        .map(|node| {
            json!({
                "id": node.id,
                "expertAgentId": node.expert_agent_id,
            })
        })
        .collect();

    let output = json!({
        "workflowId": workflow_id,
        "variant": variant,
        "nodeCount": graph.nodes.len(),
        "expertNodes": expert_nodes,
    });
    println!("{}", serde_json::to_string_pretty(&output)?);
    Ok(())
}
