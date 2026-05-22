use std::sync::Arc;

use axum::extract::State;
use axum::http::StatusCode;
use axum::response::Json;
use serde_json::{json, Value};

use crate::application::graph::{
    build_import_session_snapshot, export_and_save_graph_workflow, import_sidecar_to_graph,
    list_graph_workflows, load_graph_workflow,
};

use super::common::{snapshot_with_extra, ApiError};
use crate::control_server::RouterState;

pub(crate) async fn graph_workflows_list(State(state): State<Arc<RouterState>>) -> Json<Value> {
    let workflows = list_graph_workflows(&state.project_root).unwrap_or_default();
    Json(json!({ "workflows": workflows }))
}

pub(crate) async fn graph_workflows_export(
    State(state): State<Arc<RouterState>>,
    body: Json<Value>,
) -> Result<Json<Value>, ApiError> {
    let workflow_id = body
        .get("workflowId")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .trim();
    if workflow_id.is_empty() {
        return Err(ApiError {
            status: StatusCode::BAD_REQUEST,
            body: json!({ "error": "workflowId is required." }),
        });
    }
    let variant = body.get("variant").and_then(|v| v.as_str()).unwrap_or("");
    if variant != "playbook" && variant != "pipeline" && variant != "both" {
        return Err(ApiError {
            status: StatusCode::BAD_REQUEST,
            body: json!({ "error": "variant must be playbook, pipeline, or both." }),
        });
    }
    let description = body
        .get("description")
        .and_then(|v| v.as_str())
        .map(String::from);
    let graph = state.session.snapshot().graph;
    let (_path, sidecar) = export_and_save_graph_workflow(
        &state.project_root,
        workflow_id,
        description,
        variant,
        &graph,
    )
    .map_err(|e| ApiError {
        status: StatusCode::BAD_REQUEST,
        body: json!({ "error": e.to_string() }),
    })?;
    state.session.patch_graph_workflow_metadata(
        Some(workflow_id.to_string()),
        Some(variant.to_string()),
        Some(sidecar.updated_at.clone()),
    );
    Ok(Json(
        json!({ "path": format!(".rlm/workflows/{workflow_id}.yaml"), "sidecar": sidecar }),
    ))
}

pub(crate) async fn graph_workflows_import(
    State(state): State<Arc<RouterState>>,
    body: Json<Value>,
) -> Result<Json<Value>, ApiError> {
    let workflow_id = body
        .get("workflowId")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .trim();
    if workflow_id.is_empty() {
        return Err(ApiError {
            status: StatusCode::BAD_REQUEST,
            body: json!({ "error": "workflowId is required." }),
        });
    }
    let sidecar = load_graph_workflow(&state.project_root, workflow_id).map_err(|e| ApiError {
        status: StatusCode::BAD_REQUEST,
        body: json!({ "error": format!("Import failed: invalid graph workflow file. {e}") }),
    })?;
    let graph = import_sidecar_to_graph(&sidecar, "playbook").map_err(|e| ApiError {
        status: StatusCode::BAD_REQUEST,
        body: json!({ "error": format!("Import failed: invalid graph workflow file. {e}") }),
    })?;
    state
        .session
        .restore_snapshot(build_import_session_snapshot(graph));
    state.session.patch_graph_workflow_metadata(
        Some(workflow_id.to_string()),
        Some("playbook".into()),
        None,
    );
    Ok(Json(snapshot_with_extra(
        &state.session,
        json!({ "workflowId": workflow_id, "importedVariant": "playbook" }),
    )))
}
