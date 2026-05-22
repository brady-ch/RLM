use std::fs;
use std::sync::Arc;

use axum::extract::State;
use axum::http::StatusCode;
use axum::response::Json;
use serde::Deserialize;
use serde_json::{json, Value};

use crate::application::graph::{
    apply_pipeline_template, build_import_session_snapshot, graph_has_pipeline_template,
};
use crate::domain::types::DeleteStrategy;

use super::common::{snapshot_with_extra, spawn_graph_execution, ApiError};
use crate::control_server::RouterState;

#[derive(Debug, Deserialize)]
pub(crate) struct ChatMessageBody {
    message: Option<String>,
}

pub(crate) async fn chat_message(
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
pub(crate) struct ChatApplyBody {
    #[serde(rename = "proposalId")]
    proposal_id: Option<String>,
    #[serde(rename = "deleteStrategy")]
    delete_strategy: Option<String>,
}

pub(crate) async fn chat_apply(
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

pub(crate) async fn chat_cancel(State(state): State<Arc<RouterState>>) -> Json<Value> {
    state.session.clear_pending_mutation();
    Json(json!(state.session.snapshot()))
}

#[derive(Debug, Deserialize)]
pub(crate) struct ClarificationAbortBody {
    #[serde(rename = "questionId")]
    question_id: Option<String>,
}

pub(crate) async fn clarifications_abort(
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
pub(crate) struct ChatConfirmRunBody {
    variant: Option<String>,
    input: Option<String>,
}

pub(crate) async fn chat_confirm_run(
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
        spawn_graph_execution(&state, false);
    }
    Json(snapshot_with_extra(
        &state.session,
        json!({ "readiness": readiness, "runVariant": variant }),
    ))
}

#[derive(Debug, Deserialize)]
pub(crate) struct ChatResumeRunBody {
    confirm: Option<bool>,
}

pub(crate) async fn chat_resume_run(
    State(state): State<Arc<RouterState>>,
    Json(body): Json<ChatResumeRunBody>,
) -> Result<Json<Value>, ApiError> {
    if !body.confirm.unwrap_or(false) {
        return Err(ApiError {
            status: StatusCode::BAD_REQUEST,
            body: json!({
                "error": "Resume requires explicit user confirmation (confirm: true)."
            }),
        });
    }

    let run_state_dir = &state.paths.run_state_dir;
    if !run_state_dir.is_dir() && fs::create_dir_all(run_state_dir).is_err() {
        return Err(ApiError {
            status: StatusCode::NOT_FOUND,
            body: json!({ "error": "No run state directory configured." }),
        });
    }

    let run_id = state.current_memory_session_id();
    let store: Arc<dyn crate::ports::RunStateStorePort> = Arc::new(
        crate::persistence::FileRunStateStore::new(run_state_dir.clone()),
    );
    let persistence = crate::domain::RunStatePersistence::new(run_id.clone(), Arc::clone(&store));
    let resume = persistence.load_resume_state().map_err(|err| ApiError {
        status: StatusCode::INTERNAL_SERVER_ERROR,
        body: json!({ "error": format!("Failed to load run state: {err}") }),
    })?;
    if resume.is_none() {
        return Err(ApiError {
            status: StatusCode::NOT_FOUND,
            body: json!({ "error": "No resumable run state found for this session." }),
        });
    }

    let readiness = state.session.confirm_graph_and_run();
    if readiness.state == "ready_to_run" && !state.session.is_confirmed_execution_running() {
        spawn_graph_execution(&state, true);
    }
    Ok(Json(snapshot_with_extra(
        &state.session,
        json!({ "readiness": readiness, "resumed": true, "runId": run_id }),
    )))
}

pub(crate) async fn stop_run(State(state): State<Arc<RouterState>>, body: Json<Value>) -> Json<Value> {
    let reason = body
        .get("reason")
        .and_then(|v| v.as_str())
        .unwrap_or("Run stopped by user.");
    state.session.stop(reason);
    Json(json!(state.session.snapshot()))
}

pub(crate) async fn clarifications_answer(
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

pub(crate) async fn pause_auto_approvals(State(state): State<Arc<RouterState>>) -> Json<Value> {
    state.session.pause_future_auto_approvals();
    Json(json!(state.session.snapshot()))
}
