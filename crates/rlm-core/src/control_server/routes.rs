use std::sync::Arc;

use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::response::{IntoResponse, Json};
use axum::routing::{delete, get, post};
use axum::Router;
use serde::Deserialize;
use serde_json::{json, Value};

use crate::domain::types::{
    DeleteStrategy, ExpertRuntimeMode, GraphPosition, GraphViewport, ReplanChoice, SessionSnapshot,
};
use crate::execution::InteractiveExecutionSession;
use crate::memory::{
    build_saved_session_payload, restore_graph_workflow_metadata, restore_session_memory,
};
use crate::graph::{
    apply_pipeline_template, build_import_session_snapshot, execute_graph, export_and_save_graph_workflow,
    graph_has_pipeline_template, import_sidecar_to_graph, list_graph_workflows, load_graph_workflow,
    GraphExecutorInput,
};
use crate::ports::LanguageModel;

use super::RouterState;

fn snapshot_with_extra(session: &InteractiveExecutionSession, extra: Value) -> Value {
    let mut snap = serde_json::to_value(session.snapshot()).unwrap_or(json!({}));
    if let Some(obj) = extra.as_object() {
        if let Some(snap_obj) = snap.as_object_mut() {
            for (k, v) in obj {
                snap_obj.insert(k.clone(), v.clone());
            }
        }
    }
    snap
}

#[derive(Debug, Deserialize)]
struct MemoryQuery {
    #[serde(rename = "sessionId")]
    session_id: Option<String>,
    q: Option<String>,
    #[serde(rename = "scopeIds")]
    scope_ids: Option<String>,
    limit: Option<usize>,
}

pub fn build_router(state: Arc<RouterState>) -> Router {
    let api = Router::new()
        .route("/api/session", get(session))
        .route("/api/run-mode", get(run_mode))
        .route("/api/graph", get(graph_snapshot))
        .route("/api/graph/layout", post(graph_layout))
        .route("/api/graph/viewport", post(graph_viewport))
        .route("/api/saved-sessions", get(saved_sessions))
        .route("/api/saved-sessions/save", post(saved_sessions_save))
        .route("/api/saved-sessions/{id}", get(saved_sessions_detail))
        .route("/api/saved-sessions/{id}/open", post(saved_sessions_open))
        .route("/api/graph-workflows", get(graph_workflows_list))
        .route("/api/graph-workflows/export", post(graph_workflows_export))
        .route("/api/graph-workflows/import", post(graph_workflows_import))
        .route("/api/memory", get(memory))
        .route("/api/memory/preferences", post(memory_preferences_set))
        .route("/api/memory/preferences/{key}", delete(memory_preferences_delete))
        .route("/api/model-library", get(model_library))
        .route("/api/model-library/search", get(model_library_search))
        .route("/api/model-library/install", post(model_library_install))
        .route("/api/model-library/download", post(model_library_download))
        .route(
            "/api/model-library/select-tier",
            post(model_library_select_tier),
        )
        .route("/api/plugins", get(plugins_list))
        .route("/api/plugins/doctor", get(plugins_doctor))
        .route("/api/plugins/doctor/fix", post(plugins_doctor_fix))
        .route("/api/plugins/install", post(plugins_install))
        .route("/api/plugins/enable", post(plugins_enable))
        .route("/api/plugins/disable", post(plugins_disable))
        .route("/api/plugins/uninstall", post(plugins_uninstall))
        .route("/api/plugins/validate", post(plugins_validate))
        .route("/api/plugins/{plugin_id}/inspect", get(plugins_inspect))
        .route("/api/events", get(events))
        .route("/api/nodes/add", post(nodes_add))
        .route("/api/nodes/{node_id}/edit", post(nodes_edit))
        .route("/api/nodes/{node_id}/model", post(nodes_model))
        .route("/api/nodes/{node_id}/sampling", post(nodes_sampling))
        .route("/api/nodes/{node_id}/expert", post(nodes_expert))
        .route("/api/nodes/{node_id}/plan", post(nodes_plan))
        .route("/api/nodes/{node_id}/breakdown", post(nodes_breakdown))
        .route(
            "/api/nodes/{node_id}/extend-budget",
            post(nodes_extend_budget),
        )
        .route("/api/nodes/{node_id}/approve", post(nodes_approve))
        .route("/api/nodes/{node_id}/skip", post(nodes_skip))
        .route(
            "/api/nodes/{node_id}/quality-loop/accept",
            post(nodes_quality_accept),
        )
        .route(
            "/api/nodes/{node_id}/quality-loop/stop",
            post(nodes_quality_stop),
        )
        .route("/api/nodes/{node_id}/connect", post(nodes_connect))
        .route("/api/nodes/{node_id}/delete", post(nodes_delete))
        .route("/api/chat/message", post(chat_message))
        .route("/api/chat/apply", post(chat_apply))
        .route("/api/chat/cancel", post(chat_cancel))
        .route("/api/chat/confirm-run", post(chat_confirm_run))
        .route("/api/stop", post(stop_run))
        .route("/api/clarifications/answer", post(clarifications_answer))
        .route("/api/clarifications/abort", post(clarifications_abort))
        .route(
            "/api/pause-future-auto-approvals",
            post(pause_auto_approvals),
        );

    let ui = match state.ui_dist_dir.clone() {
        Some(dist) => Router::new().fallback_service(
            tower_http::services::ServeDir::new(dist).append_index_html_on_directories(true),
        ),
        None => Router::new().fallback(get(ui_placeholder)),
    };

    api.merge(ui).with_state(state)
}

async fn session(State(state): State<Arc<RouterState>>) -> Json<Value> {
    Json(json!(state.session.snapshot()))
}

async fn run_mode(State(state): State<Arc<RouterState>>) -> Json<Value> {
    Json(json!(state.session.run_mode_snapshot()))
}

async fn graph_snapshot(State(state): State<Arc<RouterState>>) -> Json<Value> {
    Json(json!(state.session.snapshot().graph))
}

async fn graph_layout(
    State(state): State<Arc<RouterState>>,
    body: Json<Value>,
) -> Result<Json<Value>, ApiError> {
    let raw = body.get("positions").ok_or_else(|| ApiError {
        status: StatusCode::BAD_REQUEST,
        body: json!({ "error": "Expected positions object." }),
    })?;
    let Some(obj) = raw.as_object() else {
        return Err(ApiError {
            status: StatusCode::BAD_REQUEST,
            body: json!({ "error": "Expected positions object." }),
        });
    };
    let mut positions = std::collections::HashMap::new();
    for (id, value) in obj {
        if let Some(v) = value.as_object() {
            let x = v.get("x").and_then(|n| n.as_f64()).unwrap_or(f64::NAN);
            let y = v.get("y").and_then(|n| n.as_f64()).unwrap_or(f64::NAN);
            if x.is_finite() && y.is_finite() {
                positions.insert(id.clone(), GraphPosition { x, y });
            }
        }
    }
    state.session.update_graph_layout(positions);
    Ok(Json(json!(state.session.snapshot())))
}

async fn graph_viewport(State(state): State<Arc<RouterState>>, body: Json<Value>) -> Json<Value> {
    state.session.set_graph_viewport(GraphViewport {
        x: body.get("x").and_then(|v| v.as_f64()).unwrap_or(0.0),
        y: body.get("y").and_then(|v| v.as_f64()).unwrap_or(0.0),
        zoom: body.get("zoom").and_then(|v| v.as_f64()).unwrap_or(1.0),
    });
    Json(json!(state.session.snapshot()))
}

async fn nodes_add(
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

async fn nodes_edit(
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

async fn nodes_model(
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

async fn nodes_sampling(
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

async fn nodes_expert(
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

async fn nodes_plan(
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

async fn nodes_breakdown(
    State(state): State<Arc<RouterState>>,
    Path(node_id): Path<String>,
    body: Json<Value>,
) -> Result<Json<Value>, ApiError> {
    nodes_plan(State(state), Path(node_id), body).await
}

async fn nodes_extend_budget(
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

async fn nodes_approve(
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

async fn nodes_skip(
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

async fn nodes_quality_accept(
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

async fn nodes_quality_stop(
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

async fn nodes_connect(
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

async fn nodes_delete(
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

#[derive(Debug, Deserialize)]
struct ChatMessageBody {
    message: Option<String>,
}

async fn chat_message(
    State(state): State<Arc<RouterState>>,
    Json(body): Json<ChatMessageBody>,
) -> Result<Json<Value>, ApiError> {
    let message = body.message.as_deref().unwrap_or("");
    let proposal = state
        .session
        .preview_mutation_from_chat(message)
        .map_err(ApiError::from_mutation)?;
    Ok(Json(snapshot_with_extra(
        &state.session,
        json!({ "proposal": proposal }),
    )))
}

#[derive(Debug, Deserialize)]
struct ChatApplyBody {
    #[serde(rename = "proposalId")]
    proposal_id: Option<String>,
    #[serde(rename = "deleteStrategy")]
    delete_strategy: Option<String>,
}

async fn chat_apply(
    State(state): State<Arc<RouterState>>,
    Json(body): Json<ChatApplyBody>,
) -> Result<Json<Value>, ApiError> {
    let strategy = match body.delete_strategy.as_deref() {
        Some("rewire_dependents") => Some(DeleteStrategy::RewireDependents),
        Some("delete_subtree") => Some(DeleteStrategy::DeleteSubtree),
        _ => None,
    };
    let applied = state
        .session
        .apply_pending_mutation(body.proposal_id.as_deref(), strategy)
        .map_err(ApiError::from_mutation)?;
    Ok(Json(snapshot_with_extra(
        &state.session,
        json!({ "applied": applied }),
    )))
}

async fn chat_cancel(State(state): State<Arc<RouterState>>) -> Json<Value> {
    state.session.clear_pending_mutation();
    Json(json!(state.session.snapshot()))
}

#[derive(Debug, Deserialize)]
struct ClarificationAbortBody {
    #[serde(rename = "questionId")]
    question_id: Option<String>,
}

async fn clarifications_abort(
    State(state): State<Arc<RouterState>>,
    Json(body): Json<ClarificationAbortBody>,
) -> Result<Json<Value>, ApiError> {
    let question_id = body.question_id.as_deref().unwrap_or("");
    state
        .session
        .abort_run_from_clarification(question_id)
        .map_err(ApiError::from_mutation)?;
    Ok(Json(json!(state.session.snapshot())))
}

#[derive(Debug, Deserialize)]
struct ChatConfirmRunBody {
    variant: Option<String>,
    input: Option<String>,
}

async fn chat_confirm_run(
    State(state): State<Arc<RouterState>>,
    Json(body): Json<ChatConfirmRunBody>,
) -> Json<Value> {
    let variant = body.variant.as_deref().unwrap_or("playbook");
    let input = body.input.as_deref().unwrap_or("").trim();
    if variant == "pipeline" && !input.is_empty() {
        let graph = state.session.snapshot().graph;
        if graph_has_pipeline_template(&graph) {
            if let Ok(updated) = apply_pipeline_template(graph, input) {
                state
                    .session
                    .restore_snapshot(build_import_session_snapshot(updated));
            }
        }
    }
    let readiness = state.session.confirm_graph_and_run();
    if readiness.state == "ready_to_run" && !state.session.is_confirmed_execution_running() {
        spawn_graph_execution(&state);
    }
    Json(snapshot_with_extra(
        &state.session,
        json!({ "readiness": readiness, "runVariant": variant }),
    ))
}

async fn stop_run(State(state): State<Arc<RouterState>>, body: Json<Value>) -> Json<Value> {
    let reason = body
        .get("reason")
        .and_then(|v| v.as_str())
        .unwrap_or("Run stopped by user.");
    state.session.stop(reason);
    Json(json!(state.session.snapshot()))
}

async fn clarifications_answer(
    State(state): State<Arc<RouterState>>,
    body: Json<Value>,
) -> Result<Json<Value>, ApiError> {
    let question_id = body
        .get("questionId")
        .and_then(|v| v.as_str())
        .unwrap_or("");
    let answer = body
        .get("userAnswer")
        .and_then(|v| v.as_str())
        .unwrap_or("");
    state
        .session
        .answer_clarification(question_id, answer)
        .map_err(ApiError::from_plain)?;
    Ok(Json(json!(state.session.snapshot())))
}

async fn pause_auto_approvals(State(state): State<Arc<RouterState>>) -> Json<Value> {
    state.session.pause_future_auto_approvals();
    Json(json!(state.session.snapshot()))
}

async fn graph_workflows_list(State(state): State<Arc<RouterState>>) -> Json<Value> {
    let workflows = list_graph_workflows(&state.project_root).unwrap_or_default();
    Json(json!({ "workflows": workflows }))
}

async fn graph_workflows_export(
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

async fn graph_workflows_import(
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

fn spawn_graph_execution(state: &Arc<RouterState>) {
    let session = Arc::clone(&state.session);
    state.session.begin_confirmed_execution();
    let runtime_config = state.runtime_config();
    let project_config = state
        .project_config
        .as_ref()
        .map(|loaded| loaded.config.clone());
    let exec_model = state.exec_model();
    let input = GraphExecutorInput {
        runtime_config,
        project_config,
        create_model: Arc::new(move || Arc::clone(&exec_model) as Arc<dyn LanguageModel>),
        runtime: state.runtime_context.clone(),
    };
    let lifecycle = state.lifecycle.clone();
    lifecycle.clone().spawn(async move {
        if lifecycle.is_shutdown() {
            return;
        }
        if let Err(err) = execute_graph(session.clone(), input).await {
            session.stop(err.message);
        }
    });
}

fn parse_replan(value: Option<&Value>) -> Option<ReplanChoice> {
    match value.and_then(|v| v.as_str()) {
        Some("replace") => Some(ReplanChoice::Replace),
        Some("merge") => Some(ReplanChoice::Merge),
        Some("cancel") => Some(ReplanChoice::Cancel),
        _ => None,
    }
}

struct ApiError {
    status: StatusCode,
    body: Value,
}

impl ApiError {
    fn from_plain(err: String) -> Self {
        if err.contains("Stale approval token") || err.contains("not awaiting approval") {
            Self {
                status: StatusCode::CONFLICT,
                body: json!({ "error": err }),
            }
        } else if err.contains("Unknown node") {
            Self {
                status: StatusCode::NOT_FOUND,
                body: json!({ "error": err }),
            }
        } else {
            Self {
                status: StatusCode::BAD_REQUEST,
                body: json!({ "error": err }),
            }
        }
    }

    fn from_mutation(err: String) -> Self {
        if let Some(session) = err.strip_prefix("MUTATION:") {
            let parts: Vec<_> = session.splitn(6, '|').collect();
            if parts.len() >= 3 {
                return Self {
                    status: StatusCode::CONFLICT,
                    body: json!({
                        "code": parts[0],
                        "error": parts[1],
                        "nodeIds": parts.get(2).map(|s| s.split(',').collect::<Vec<_>>()).unwrap_or_default(),
                        "details": parts.get(3).filter(|s| !s.is_empty()),
                        "suggestedFix": parts.get(4).filter(|s| !s.is_empty()),
                    }),
                };
            }
        }
        Self::from_plain(err)
    }
}

impl IntoResponse for ApiError {
    fn into_response(self) -> axum::response::Response {
        (self.status, Json(self.body)).into_response()
    }
}

// --- preserved handlers from prior routes ---

use axum::extract::Query;
use axum::response::sse::{Event, KeepAlive, Sse};
use axum::response::Html;
use futures::stream::{self, StreamExt};
use tokio_stream::wrappers::BroadcastStream;

async fn memory_inspect_payload(
    state: &Arc<RouterState>,
    session_id: &str,
) -> Result<Value, ApiError> {
    if !state.paths.memory_configured() {
        return Err(ApiError {
            status: StatusCode::NOT_FOUND,
            body: super::state::memory_unconfigured(),
        });
    }
    let semantic = state.memory_index(session_id).await;
    let snapshot = semantic.store().inspect(session_id).map_err(|err| ApiError {
        status: StatusCode::INTERNAL_SERVER_ERROR,
        body: json!({ "error": err.to_string() }),
    })?;
    let vector_index = semantic.status().await;
    let mut value = serde_json::to_value(snapshot).map_err(|err| ApiError {
        status: StatusCode::INTERNAL_SERVER_ERROR,
        body: json!({ "error": err.to_string() }),
    })?;
    if let Some(obj) = value.as_object_mut() {
        obj.insert(
            "vectorIndex".into(),
            serde_json::to_value(vector_index).unwrap_or(json!({})),
        );
    }
    Ok(value)
}

#[derive(Debug, Deserialize)]
struct SavedSessionSaveBody {
    id: Option<String>,
    name: Option<String>,
}

async fn saved_sessions_save(
    State(state): State<Arc<RouterState>>,
    Json(body): Json<SavedSessionSaveBody>,
) -> impl IntoResponse {
    if !state.paths.sessions_configured() {
        return (
            StatusCode::NOT_FOUND,
            Json(super::state::saved_sessions_unconfigured()),
        )
            .into_response();
    }
    if !state.paths.memory_configured() {
        return (
            StatusCode::NOT_FOUND,
            Json(super::state::memory_unconfigured()),
        )
            .into_response();
    }

    let run_id = state.current_memory_session_id();
    let snapshot = state.session.snapshot();
    let snapshot_value = serde_json::to_value(&snapshot).unwrap_or(json!({}));
    let semantic = state.memory_index(&run_id).await;
    let ann_arc = semantic.ann();
    let ann_guard = ann_arc.lock().await;
    let payload = match build_saved_session_payload(
        &snapshot_value,
        &run_id,
        semantic.store(),
        ann_guard.json_index(),
        None,
        state.session.graph_workflow_metadata_value(),
    ) {
        Ok(payload) => payload,
        Err(err) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": err.to_string() })),
            )
                .into_response();
        }
    };
    drop(ann_guard);

    let store = crate::persistence::FileSessionStore::new(state.paths.sessions_dir.clone());
    match store.save(crate::persistence::session_store::SaveSessionRequest {
        id: body.id,
        name: body.name,
        payload,
    }) {
        Ok(record) => (StatusCode::OK, Json(serde_json::to_value(record).unwrap())).into_response(),
        Err(err) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": err.to_string() })),
        )
            .into_response(),
    }
}

async fn saved_sessions_detail(
    State(state): State<Arc<RouterState>>,
    Path(id): Path<String>,
) -> impl IntoResponse {
    if !state.paths.sessions_configured() {
        return (
            StatusCode::NOT_FOUND,
            Json(super::state::saved_sessions_unconfigured()),
        )
            .into_response();
    }
    let store = crate::persistence::FileSessionStore::new(state.paths.sessions_dir.clone());
    match store.load(&id) {
        Ok(record) => (StatusCode::OK, Json(serde_json::to_value(record).unwrap())).into_response(),
        Err(err) if err.kind() == std::io::ErrorKind::NotFound => (
            StatusCode::NOT_FOUND,
            Json(json!({ "error": format!("Saved session \"{id}\" not found.") })),
        )
            .into_response(),
        Err(err) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": err.to_string() })),
        )
            .into_response(),
    }
}

async fn saved_sessions_open(
    State(state): State<Arc<RouterState>>,
    Path(id): Path<String>,
) -> impl IntoResponse {
    if !state.paths.sessions_configured() {
        return (
            StatusCode::NOT_FOUND,
            Json(super::state::saved_sessions_unconfigured()),
        )
            .into_response();
    }
    if !state.paths.memory_configured() {
        return (
            StatusCode::NOT_FOUND,
            Json(super::state::memory_unconfigured()),
        )
            .into_response();
    }

    let store = crate::persistence::FileSessionStore::new(state.paths.sessions_dir.clone());
    let saved = match store.load(&id) {
        Ok(record) => record,
        Err(err) if err.kind() == std::io::ErrorKind::NotFound => {
            return (
                StatusCode::NOT_FOUND,
                Json(json!({ "error": format!("Saved session \"{id}\" not found.") })),
            )
                .into_response();
        }
        Err(err) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": err.to_string() })),
            )
                .into_response();
        }
    };

    if saved.verification.status != "complete" {
        return (
            StatusCode::CONFLICT,
            Json(json!({
                "error": "Saved session restore is unsafe.",
                "savedSession": saved,
            })),
        )
            .into_response();
    }

    let semantic = state.memory_index(&state.current_memory_session_id()).await;
    let ann_arc = semantic.ann();
    let mut ann = ann_arc.lock().await;
    let restored_run_id = match restore_session_memory(&saved.payload, semantic.store(), &mut ann) {
        Ok(run_id) => run_id,
        Err(err) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": err.to_string() })),
            )
                .into_response();
        }
    };
    drop(ann);
    state.set_memory_session_id(restored_run_id.clone());

    let snapshot: SessionSnapshot = match serde_json::from_value(saved.payload.session.clone()) {
        Ok(snapshot) => snapshot,
        Err(err) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": err.to_string() })),
            )
                .into_response();
        }
    };
    state.session.restore_snapshot(snapshot);

    let (metadata, degraded, note) = restore_graph_workflow_metadata(&saved.payload);
    state
        .session
        .set_graph_workflow_metadata_from_restore(&metadata);

    let mut response = snapshot_with_extra(&state.session, json!({ "savedSession": saved }));
    if let Some(obj) = response.as_object_mut() {
        obj.insert(
            "graphWorkflowMetadataRestore".into(),
            if degraded {
                json!({ "degraded": true, "note": note })
            } else {
                json!({ "degraded": false })
            },
        );
    }
    (StatusCode::OK, Json(response)).into_response()
}

#[derive(Debug, Deserialize)]
struct MemoryPreferenceBody {
    key: Option<String>,
    value: Option<String>,
    lifetime: Option<String>,
}

async fn memory_preferences_set(
    State(state): State<Arc<RouterState>>,
    Json(body): Json<MemoryPreferenceBody>,
) -> Result<Json<Value>, ApiError> {
    if !state.paths.memory_configured() {
        return Err(ApiError {
            status: StatusCode::NOT_FOUND,
            body: super::state::memory_unconfigured(),
        });
    }
    let key = body.key.as_deref().unwrap_or("").trim();
    let value = body.value.as_deref().unwrap_or("").trim();
    if key.is_empty() {
        return Err(ApiError {
            status: StatusCode::BAD_REQUEST,
            body: json!({ "error": "Preference key is required." }),
        });
    }
    let lifetime = if body.lifetime.as_deref() == Some("permanent") {
        "permanent"
    } else {
        "project"
    };
    let session_id = state.current_memory_session_id();
    let semantic = state.memory_index(&session_id).await;
    semantic
        .store()
        .set_preference(&session_id, key, value, "ui", lifetime)
        .map_err(|err| ApiError {
            status: StatusCode::BAD_REQUEST,
            body: json!({ "error": err.to_string() }),
        })?;
    semantic.enqueue_rebuild();
    memory_inspect_payload(&state, &session_id)
        .await
        .map(Json)
}

async fn memory_preferences_delete(
    State(state): State<Arc<RouterState>>,
    Path(key): Path<String>,
) -> Result<Json<Value>, ApiError> {
    if !state.paths.memory_configured() {
        return Err(ApiError {
            status: StatusCode::NOT_FOUND,
            body: super::state::memory_unconfigured(),
        });
    }
    let session_id = state.current_memory_session_id();
    let semantic = state.memory_index(&session_id).await;
    semantic
        .store()
        .delete_preference(&session_id, &key)
        .map_err(|err| ApiError {
            status: StatusCode::BAD_REQUEST,
            body: json!({ "error": err.to_string() }),
        })?;
    semantic.enqueue_rebuild();
    memory_inspect_payload(&state, &session_id)
        .await
        .map(Json)
}

async fn saved_sessions(State(state): State<Arc<RouterState>>) -> impl IntoResponse {
    if !state.paths.sessions_configured() {
        return (
            StatusCode::NOT_FOUND,
            Json(super::state::saved_sessions_unconfigured()),
        )
            .into_response();
    }

    let store = crate::persistence::FileSessionStore::new(state.paths.sessions_dir.clone());
    match store.list() {
        Ok(sessions) => (StatusCode::OK, Json(json!({ "sessions": sessions }))).into_response(),
        Err(err) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": err.to_string() })),
        )
            .into_response(),
    }
}

async fn memory(
    State(state): State<Arc<RouterState>>,
    Query(query): Query<MemoryQuery>,
) -> impl IntoResponse {
    if !state.paths.memory_configured() {
        return (
            StatusCode::NOT_FOUND,
            Json(super::state::memory_unconfigured()),
        )
            .into_response();
    }

    let session_id = query
        .session_id
        .unwrap_or_else(|| state.current_memory_session_id());
    let semantic = state.memory_index(&session_id).await;

    match semantic.store().inspect(&session_id) {
        Ok(snapshot) => {
            let vector_index = semantic.status().await;
            let mut value = match serde_json::to_value(snapshot) {
                Ok(value) => value,
                Err(err) => {
                    return (
                        StatusCode::INTERNAL_SERVER_ERROR,
                        Json(json!({ "error": err.to_string() })),
                    )
                        .into_response();
                }
            };

            if let Some(obj) = value.as_object_mut() {
                obj.insert(
                    "vectorIndex".into(),
                    serde_json::to_value(vector_index).unwrap_or(json!({})),
                );

                if let Some(q) = query.q.as_ref().map(|s| s.trim()).filter(|s| !s.is_empty()) {
                    let scope_ids: Vec<String> = query
                        .scope_ids
                        .as_deref()
                        .map(|raw| {
                            raw.split(',')
                                .map(str::trim)
                                .filter(|part| !part.is_empty())
                                .map(str::to_string)
                                .collect()
                        })
                        .unwrap_or_default();
                    let retrieval = semantic
                        .search(q, &scope_ids, query.limit.unwrap_or(4))
                        .await;
                    obj.insert(
                        "retrieval".into(),
                        json!({
                            "query": q,
                            "status": match retrieval.status {
                                crate::persistence::RetrievalStatus::Ready => "ready",
                                crate::persistence::RetrievalStatus::Empty => "empty",
                                crate::persistence::RetrievalStatus::Degraded => "degraded",
                            },
                            "reason": retrieval.reason,
                            "hits": retrieval.hits,
                        }),
                    );
                }
            }

            (StatusCode::OK, Json(value)).into_response()
        }
        Err(err) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": err.to_string() })),
        )
            .into_response(),
    }
}

async fn model_library(State(state): State<Arc<RouterState>>) -> impl IntoResponse {
    let Some(library) = state.model_library.as_ref() else {
        return (
            StatusCode::NOT_FOUND,
            Json(super::state::model_library_unconfigured()),
        )
            .into_response();
    };
    Json(library.snapshot().await).into_response()
}

async fn model_library_search(
    State(state): State<Arc<RouterState>>,
    axum::extract::Query(query): axum::extract::Query<ModelLibrarySearchQuery>,
) -> impl IntoResponse {
    let Some(library) = state.model_library.as_ref() else {
        return (
            StatusCode::NOT_FOUND,
            Json(super::state::model_library_unconfigured()),
        )
            .into_response();
    };
    match library
        .search_huggingface(query.q.as_deref().unwrap_or(""))
        .await
    {
        Ok(result) => Json(serde_json::to_value(result).unwrap_or(json!({}))).into_response(),
        Err(err) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": err })),
        )
            .into_response(),
    }
}

#[derive(Debug, Deserialize)]
struct ModelLibrarySearchQuery {
    q: Option<String>,
}

#[derive(Debug, Deserialize)]
struct ModelLibraryInstallBody {
    model: Option<String>,
}

async fn model_library_install(
    State(state): State<Arc<RouterState>>,
    Json(body): Json<ModelLibraryInstallBody>,
) -> impl IntoResponse {
    let Some(library) = state.model_library.as_ref() else {
        return (
            StatusCode::NOT_FOUND,
            Json(super::state::model_library_unconfigured()),
        )
            .into_response();
    };
    match library
        .start_install(body.model.as_deref().unwrap_or(""))
        .await
    {
        Ok(job) => {
            let library_snapshot = library.snapshot().await;
            Json(json!({ "job": job, "library": library_snapshot })).into_response()
        }
        Err(err) => (StatusCode::BAD_REQUEST, Json(json!({ "error": err }))).into_response(),
    }
}

#[derive(Debug, Deserialize)]
struct ModelLibraryDownloadBody {
    model: Option<String>,
    file: Option<String>,
}

async fn model_library_download(
    State(state): State<Arc<RouterState>>,
    Json(body): Json<ModelLibraryDownloadBody>,
) -> impl IntoResponse {
    let Some(library) = state.model_library.as_ref() else {
        return (
            StatusCode::NOT_FOUND,
            Json(super::state::model_library_unconfigured()),
        )
            .into_response();
    };
    let repo_id = body.model.as_deref().unwrap_or("");
    match library
        .download_hf_model(repo_id, body.file.as_deref())
        .await
    {
        Ok(record) => {
            let library_snapshot = library.snapshot().await;
            Json(json!({ "record": record, "library": library_snapshot })).into_response()
        }
        Err(err) => (
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": err.to_string() })),
        )
            .into_response(),
    }
}

#[derive(Debug, Deserialize)]
struct ModelLibrarySelectTierBody {
    tier: Option<String>,
    model: Option<String>,
}

async fn model_library_select_tier(
    State(state): State<Arc<RouterState>>,
    Json(body): Json<ModelLibrarySelectTierBody>,
) -> impl IntoResponse {
    let Some(library) = state.model_library.as_ref() else {
        return (
            StatusCode::NOT_FOUND,
            Json(super::state::model_library_unconfigured()),
        )
            .into_response();
    };
    match library
        .select_tier(
            body.tier.as_deref().unwrap_or(""),
            body.model.as_deref().unwrap_or(""),
        )
        .await
    {
        Ok(tiers) => {
            let library_snapshot = library.snapshot().await;
            Json(json!({ "tiers": tiers, "library": library_snapshot })).into_response()
        }
        Err(err) => (StatusCode::BAD_REQUEST, Json(json!({ "error": err }))).into_response(),
    }
}

async fn plugins_list(State(state): State<Arc<RouterState>>) -> impl IntoResponse {
    let Some(registry) = state.plugin_registry.as_ref() else {
        return Json(super::state::plugins_list_empty()).into_response();
    };
    match registry.list().await {
        Ok(plugins) => Json(json!({ "plugins": plugins })).into_response(),
        Err(err) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": err })),
        )
            .into_response(),
    }
}

async fn plugins_doctor(State(state): State<Arc<RouterState>>) -> impl IntoResponse {
    let Some(registry) = state.plugin_registry.as_ref() else {
        return (
            StatusCode::NOT_FOUND,
            Json(json!({ "error": "Plugin registry is not configured." })),
        )
            .into_response();
    };
    match registry.doctor(false).await {
        Ok(result) => Json(serde_json::to_value(result).unwrap_or(json!({}))).into_response(),
        Err(err) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": err })),
        )
            .into_response(),
    }
}

async fn plugins_doctor_fix(State(state): State<Arc<RouterState>>) -> impl IntoResponse {
    let Some(registry) = state.plugin_registry.as_ref() else {
        return (
            StatusCode::NOT_FOUND,
            Json(json!({ "error": "Plugin registry is not configured." })),
        )
            .into_response();
    };
    match registry.doctor(true).await {
        Ok(result) => Json(serde_json::to_value(result).unwrap_or(json!({}))).into_response(),
        Err(err) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": err })),
        )
            .into_response(),
    }
}

#[derive(Debug, Deserialize)]
struct PluginInstallBody {
    path: Option<String>,
    source: Option<String>,
    url: Option<String>,
    confirm: Option<bool>,
    yes: Option<bool>,
}

async fn plugins_install(
    State(state): State<Arc<RouterState>>,
    Json(body): Json<PluginInstallBody>,
) -> impl IntoResponse {
    let Some(registry) = state.plugin_registry.as_ref() else {
        return (
            StatusCode::NOT_FOUND,
            Json(json!({ "error": "Plugin registry is not configured." })),
        )
            .into_response();
    };
    let path = body.path.or(body.source).or(body.url).unwrap_or_default();
    if path.trim().is_empty() {
        return (
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "Missing path or url." })),
        )
            .into_response();
    }
    let confirm = body.confirm.unwrap_or(false) || body.yes.unwrap_or(false);
    match registry.install(&path, confirm).await {
        Ok(result) => Json(result).into_response(),
        Err(err) => (StatusCode::BAD_REQUEST, Json(json!({ "error": err }))).into_response(),
    }
}

#[derive(Debug, Deserialize)]
struct PluginIdBody {
    id: Option<String>,
}

async fn plugins_enable(
    State(state): State<Arc<RouterState>>,
    Json(body): Json<PluginIdBody>,
) -> impl IntoResponse {
    plugin_id_mutation(state, body.id, |registry, id| async move {
        registry.enable(&id).await
    })
    .await
}

async fn plugins_disable(
    State(state): State<Arc<RouterState>>,
    Json(body): Json<PluginIdBody>,
) -> impl IntoResponse {
    plugin_id_mutation(state, body.id, |registry, id| async move {
        registry.disable(&id).await
    })
    .await
}

async fn plugins_uninstall(
    State(state): State<Arc<RouterState>>,
    Json(body): Json<PluginIdBody>,
) -> impl IntoResponse {
    plugin_id_mutation(state, body.id, |registry, id| async move {
        registry.uninstall(&id).await
    })
    .await
}

async fn plugin_id_mutation<F, Fut>(
    state: Arc<RouterState>,
    id: Option<String>,
    action: F,
) -> axum::response::Response
where
    F: FnOnce(std::sync::Arc<crate::plugins::PluginRegistryService>, String) -> Fut,
    Fut: std::future::Future<Output = Result<crate::plugins::PluginMutationResult, String>>,
{
    let Some(registry) = state.plugin_registry.as_ref() else {
        return (
            StatusCode::NOT_FOUND,
            Json(json!({ "error": "Plugin registry is not configured." })),
        )
            .into_response();
    };
    let id = id.unwrap_or_default();
    if id.trim().is_empty() {
        return (
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "Missing id." })),
        )
            .into_response();
    }
    match action(Arc::clone(registry), id).await {
        Ok(result) => Json(serde_json::to_value(result).unwrap_or(json!({}))).into_response(),
        Err(err) => (StatusCode::BAD_REQUEST, Json(json!({ "error": err }))).into_response(),
    }
}

#[derive(Debug, Deserialize)]
struct PluginValidateBody {
    path: Option<String>,
}

async fn plugins_validate(
    State(state): State<Arc<RouterState>>,
    Json(body): Json<PluginValidateBody>,
) -> impl IntoResponse {
    let Some(registry) = state.plugin_registry.as_ref() else {
        return (
            StatusCode::NOT_FOUND,
            Json(json!({ "error": "Plugin registry is not configured." })),
        )
            .into_response();
    };
    let path = body.path.unwrap_or_default();
    if path.trim().is_empty() {
        return (
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "Missing path." })),
        )
            .into_response();
    }
    match registry.validate_path(&path).await {
        Ok(manifest) => Json(json!({ "ok": true, "manifest": manifest })).into_response(),
        Err(err) => (StatusCode::BAD_REQUEST, Json(json!({ "error": err }))).into_response(),
    }
}

async fn plugins_inspect(
    State(state): State<Arc<RouterState>>,
    Path(plugin_id): Path<String>,
) -> impl IntoResponse {
    let Some(registry) = state.plugin_registry.as_ref() else {
        return (
            StatusCode::NOT_FOUND,
            Json(json!({ "error": "Plugin registry is not configured." })),
        )
            .into_response();
    };
    match registry.inspect(&plugin_id).await {
        Ok(result) => Json(result).into_response(),
        Err(err) => (StatusCode::NOT_FOUND, Json(json!({ "error": err }))).into_response(),
    }
}

async fn events(
    State(state): State<Arc<RouterState>>,
) -> Sse<impl StreamExt<Item = Result<Event, std::convert::Infallible>>> {
    let snapshot = state.session.snapshot();
    let initial = Event::default()
        .event("snapshot")
        .data(serde_json::to_string(&snapshot).unwrap_or_else(|_| "{}".into()));

    let rx = state.session.subscribe();
    let execution_stream = BroadcastStream::new(rx).filter_map(|result| {
        futures::future::ready(result.ok().map(|event| {
            Ok(Event::default()
                .event("execution")
                .data(serde_json::to_string(&event).unwrap_or_else(|_| "{}".into())))
        }))
    });

    let stream = stream::once(async move { Ok(initial) }).chain(execution_stream);
    Sse::new(stream).keep_alive(KeepAlive::default())
}

async fn ui_placeholder() -> Html<&'static str> {
    Html("<!doctype html><title>RLM UI</title><div id=\"root\">Build the React UI with npm run build:ui.</div>")
}
