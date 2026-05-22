use std::sync::Arc;

use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::response::{IntoResponse, Json};
use axum::routing::{get, post};
use axum::Router;
use serde::Deserialize;
use serde_json::{json, Value};

use crate::domain::types::{
    DeleteStrategy, ExpertRuntimeMode, GraphPosition, GraphViewport, ReplanChoice,
};
use crate::execution::InteractiveExecutionSession;
use crate::graph::{
    build_import_session_snapshot, execute_graph, export_and_save_graph_workflow,
    import_sidecar_to_graph, list_graph_workflows, load_graph_workflow, GraphExecutorInput,
};
use crate::persistence::FileMemoryStore;
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
}

pub fn build_router(state: RouterState) -> Router {
    let api = Router::new()
        .route("/api/session", get(session))
        .route("/api/run-mode", get(run_mode))
        .route("/api/graph", get(graph_snapshot))
        .route("/api/graph/layout", post(graph_layout))
        .route("/api/graph/viewport", post(graph_viewport))
        .route("/api/saved-sessions", get(saved_sessions))
        .route("/api/graph-workflows", get(graph_workflows_list))
        .route("/api/graph-workflows/export", post(graph_workflows_export))
        .route("/api/graph-workflows/import", post(graph_workflows_import))
        .route("/api/memory", get(memory))
        .route("/api/model-library", get(model_library))
        .route("/api/plugins", get(plugins_list))
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
        .route("/api/chat/confirm-run", post(chat_confirm_run))
        .route("/api/stop", post(stop_run))
        .route("/api/clarifications/answer", post(clarifications_answer))
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

async fn session(State(state): State<RouterState>) -> Json<Value> {
    Json(json!(state.session.snapshot()))
}

async fn run_mode(State(state): State<RouterState>) -> Json<Value> {
    Json(json!(state.session.run_mode_snapshot()))
}

async fn graph_snapshot(State(state): State<RouterState>) -> Json<Value> {
    Json(json!(state.session.snapshot().graph))
}

async fn graph_layout(
    State(state): State<RouterState>,
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

async fn graph_viewport(State(state): State<RouterState>, body: Json<Value>) -> Json<Value> {
    state.session.set_graph_viewport(GraphViewport {
        x: body.get("x").and_then(|v| v.as_f64()).unwrap_or(0.0),
        y: body.get("y").and_then(|v| v.as_f64()).unwrap_or(0.0),
        zoom: body.get("zoom").and_then(|v| v.as_f64()).unwrap_or(1.0),
    });
    Json(json!(state.session.snapshot()))
}

async fn nodes_add(
    State(state): State<RouterState>,
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
    State(state): State<RouterState>,
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
    State(state): State<RouterState>,
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
    State(state): State<RouterState>,
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
    State(state): State<RouterState>,
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
    State(state): State<RouterState>,
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
    State(state): State<RouterState>,
    Path(node_id): Path<String>,
    body: Json<Value>,
) -> Result<Json<Value>, ApiError> {
    nodes_plan(State(state), Path(node_id), body).await
}

async fn nodes_extend_budget(
    State(state): State<RouterState>,
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
    State(state): State<RouterState>,
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
    State(state): State<RouterState>,
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
    State(state): State<RouterState>,
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
    State(state): State<RouterState>,
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
    State(state): State<RouterState>,
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
    State(state): State<RouterState>,
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

async fn chat_confirm_run(State(state): State<RouterState>) -> Json<Value> {
    let readiness = state.session.confirm_graph_and_run();
    if readiness.state == "ready_to_run" && !state.session.is_confirmed_execution_running() {
        spawn_graph_execution(&state);
    }
    Json(snapshot_with_extra(
        &state.session,
        json!({ "readiness": readiness, "runVariant": "playbook" }),
    ))
}

async fn stop_run(State(state): State<RouterState>, body: Json<Value>) -> Json<Value> {
    let reason = body
        .get("reason")
        .and_then(|v| v.as_str())
        .unwrap_or("Run stopped by user.");
    state.session.stop(reason);
    Json(json!(state.session.snapshot()))
}

async fn clarifications_answer(
    State(state): State<RouterState>,
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

async fn pause_auto_approvals(State(state): State<RouterState>) -> Json<Value> {
    state.session.pause_future_auto_approvals();
    Json(json!(state.session.snapshot()))
}

async fn graph_workflows_list(State(state): State<RouterState>) -> Json<Value> {
    let workflows = list_graph_workflows(&state.project_root).unwrap_or_default();
    Json(json!({ "workflows": workflows }))
}

async fn graph_workflows_export(
    State(state): State<RouterState>,
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
    State(state): State<RouterState>,
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

fn spawn_graph_execution(state: &RouterState) {
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
    };
    tokio::spawn(async move {
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

async fn saved_sessions(State(state): State<RouterState>) -> impl IntoResponse {
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
    State(state): State<RouterState>,
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
        .unwrap_or_else(|| state.memory_session_id.clone());
    let store = FileMemoryStore::new(state.paths.memory_dir.clone());
    match store.inspect(&session_id) {
        Ok(snapshot) => match serde_json::to_value(snapshot) {
            Ok(value) => (StatusCode::OK, Json(value)).into_response(),
            Err(err) => (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": err.to_string() })),
            )
                .into_response(),
        },
        Err(err) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": err.to_string() })),
        )
            .into_response(),
    }
}

async fn model_library(State(_): State<RouterState>) -> impl IntoResponse {
    (
        StatusCode::NOT_FOUND,
        Json(super::state::model_library_unconfigured()),
    )
}

async fn plugins_list(State(_): State<RouterState>) -> Json<Value> {
    Json(super::state::plugins_list_empty())
}

async fn events(
    State(state): State<RouterState>,
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
