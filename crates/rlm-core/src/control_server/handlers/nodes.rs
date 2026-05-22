use std::sync::Arc;

use axum::extract::{Path, State};
use axum::response::Json;
use serde_json::{json, Value};

use crate::domain::types::{DeleteStrategy, ExpertRuntimeMode};

use super::common::{parse_replan, snapshot_with_extra, ApiError};
use crate::control_server::RouterState;

pub(crate) async fn nodes_add(
    State(state): State<Arc<RouterState>>,
    body: Json<Value>,
) -> Result<Json<Value>, ApiError> {
    let parent_id = body.get("parentId").and_then(|v| v.as_str()).unwrap_or("");
    let prompt = body.get("prompt").and_then(|v| v.as_str()).unwrap_or("");
    let kind = body
        .get("kind")
        .and_then(|v| v.as_str())
        .filter(|k| *k == "workflow-agent" || *k == "workflow-qa")
        .unwrap_or("task");
    let node = state
        .session
        .add_node(parent_id, prompt, kind)
        .map_err(ApiError::from_mutation)?;
    Ok(Json(snapshot_with_extra(
        &state.session,
        json!({ "addedNodeId": node.id }),
    )))
}

pub(crate) async fn nodes_edit(
    State(state): State<Arc<RouterState>>,
    Path(node_id): Path<String>,
    body: Json<Value>,
) -> Result<Json<Value>, ApiError> {
    let prompt = body.get("prompt").and_then(|v| v.as_str()).unwrap_or("");
    state
        .session
        .edit_node_prompt(&node_id, prompt)
        .map_err(ApiError::from_plain)?;
    Ok(Json(json!(state.session.snapshot())))
}

pub(crate) async fn nodes_model(
    State(state): State<Arc<RouterState>>,
    Path(node_id): Path<String>,
    body: Json<Value>,
) -> Result<Json<Value>, ApiError> {
    let model = body.get("model").and_then(|v| v.as_str()).unwrap_or("");
    state
        .session
        .set_node_model_override(&node_id, model)
        .map_err(ApiError::from_mutation)?;
    Ok(Json(json!(state.session.snapshot())))
}

pub(crate) async fn nodes_sampling(
    State(state): State<Arc<RouterState>>,
    Path(node_id): Path<String>,
    body: Json<Value>,
) -> Result<Json<Value>, ApiError> {
    state
        .session
        .set_node_sampling_override(&node_id, body.0.clone())
        .map_err(ApiError::from_plain)?;
    Ok(Json(json!(state.session.snapshot())))
}

pub(crate) async fn nodes_expert(
    State(state): State<Arc<RouterState>>,
    Path(node_id): Path<String>,
    body: Json<Value>,
) -> Result<Json<Value>, ApiError> {
    let runtime = body
        .get("runtime")
        .and_then(|v| v.as_str())
        .and_then(|v| match v {
            "single-pass" => Some(ExpertRuntimeMode::SinglePass),
            "rlm" => Some(ExpertRuntimeMode::Rlm),
            _ => None,
        });
    let tool_allowlist = body
        .get("toolAllowlist")
        .and_then(|v| v.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|v| v.as_str().map(String::from))
                .collect::<Vec<_>>()
        });
    let purpose_tiers = body.get("purposeTiers").and_then(|v| {
        serde_json::from_value::<std::collections::HashMap<String, String>>(v.clone()).ok()
    });
    state
        .session
        .set_node_expert_override(
            &node_id,
            body.get("agentId").and_then(|v| v.as_str()),
            runtime,
            tool_allowlist,
            purpose_tiers,
        )
        .map_err(ApiError::from_mutation)?;
    Ok(Json(json!(state.session.snapshot())))
}

pub(crate) async fn nodes_plan(
    State(state): State<Arc<RouterState>>,
    Path(node_id): Path<String>,
    body: Json<Value>,
) -> Result<Json<Value>, ApiError> {
    let replan = parse_replan(body.get("replan"));
    let plan_model = state.plan_model();
    let result = state
        .session
        .plan_node(&node_id, replan, plan_model)
        .await
        .map_err(ApiError::from_mutation)?;
    Ok(Json(snapshot_with_extra(
        &state.session,
        json!({ "plan": result }),
    )))
}

pub(crate) async fn nodes_breakdown(
    State(state): State<Arc<RouterState>>,
    Path(node_id): Path<String>,
    body: Json<Value>,
) -> Result<Json<Value>, ApiError> {
    nodes_plan(State(state), Path(node_id), body).await
}

pub(crate) async fn nodes_extend_budget(
    State(state): State<Arc<RouterState>>,
    Path(node_id): Path<String>,
    body: Json<Value>,
) -> Result<Json<Value>, ApiError> {
    let max_depth = body
        .get("maxDepth")
        .and_then(|v| v.as_i64())
        .map(|v| v as i32);
    let max_nodes = body
        .get("maxNodes")
        .and_then(|v| v.as_i64())
        .map(|v| v as i32);
    let budget = state
        .session
        .extend_plan_budget(&node_id, max_depth, max_nodes)
        .map_err(ApiError::from_plain)?;
    Ok(Json(snapshot_with_extra(
        &state.session,
        json!({ "budget": budget }),
    )))
}

pub(crate) async fn nodes_approve(
    State(state): State<Arc<RouterState>>,
    Path(node_id): Path<String>,
    body: Json<Value>,
) -> Result<Json<Value>, ApiError> {
    let token = body.get("token").and_then(|v| v.as_str());
    let duplicate = state
        .session
        .approve_node(&node_id, token)
        .map_err(ApiError::from_plain)?;
    Ok(Json(snapshot_with_extra(
        &state.session,
        json!({ "duplicate": duplicate }),
    )))
}

pub(crate) async fn nodes_skip(
    State(state): State<Arc<RouterState>>,
    Path(node_id): Path<String>,
    body: Json<Value>,
) -> Result<Json<Value>, ApiError> {
    let token = body.get("token").and_then(|v| v.as_str());
    let duplicate = state
        .session
        .skip_node(&node_id, token)
        .map_err(ApiError::from_plain)?;
    Ok(Json(snapshot_with_extra(
        &state.session,
        json!({ "duplicate": duplicate }),
    )))
}

pub(crate) async fn nodes_quality_accept(
    State(state): State<Arc<RouterState>>,
    Path(node_id): Path<String>,
    body: Json<Value>,
) -> Result<Json<Value>, ApiError> {
    let reason = body.get("reason").and_then(|v| v.as_str());
    state
        .session
        .accept_quality_loop(&node_id, reason)
        .map_err(ApiError::from_plain)?;
    Ok(Json(json!(state.session.snapshot())))
}

pub(crate) async fn nodes_quality_stop(
    State(state): State<Arc<RouterState>>,
    Path(node_id): Path<String>,
    body: Json<Value>,
) -> Result<Json<Value>, ApiError> {
    let reason = body.get("reason").and_then(|v| v.as_str());
    state
        .session
        .stop_quality_loop(&node_id, reason)
        .map_err(ApiError::from_plain)?;
    Ok(Json(json!(state.session.snapshot())))
}

pub(crate) async fn nodes_connect(
    State(state): State<Arc<RouterState>>,
    Path(node_id): Path<String>,
    body: Json<Value>,
) -> Result<Json<Value>, ApiError> {
    let parent_id = body.get("parentId").and_then(|v| v.as_str()).unwrap_or("");
    let source_handle = body
        .get("sourceHandle")
        .and_then(|v| v.as_str())
        .map(String::from);
    let target_handle = body
        .get("targetHandle")
        .and_then(|v| v.as_str())
        .map(String::from);
    state
        .session
        .connect_node(&node_id, parent_id, source_handle, target_handle)
        .map_err(ApiError::from_plain)?;
    Ok(Json(json!(state.session.snapshot())))
}

pub(crate) async fn nodes_delete(
    State(state): State<Arc<RouterState>>,
    Path(node_id): Path<String>,
    body: Json<Value>,
) -> Result<Json<Value>, ApiError> {
    let strategy = body
        .get("strategy")
        .and_then(|v| v.as_str())
        .and_then(|v| match v {
            "rewire_dependents" => Some(DeleteStrategy::RewireDependents),
            "delete_subtree" => Some(DeleteStrategy::DeleteSubtree),
            _ => None,
        });
    let deleted = state
        .session
        .delete_node_with_strategy(&node_id, strategy)
        .map_err(ApiError::from_mutation)?;
    Ok(Json(snapshot_with_extra(
        &state.session,
        json!({ "deletedNodeIds": deleted }),
    )))
}
