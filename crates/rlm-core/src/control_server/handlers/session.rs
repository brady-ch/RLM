use std::sync::Arc;

use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::response::{IntoResponse, Json};
use serde::Deserialize;
use serde_json::{json, Value};

use crate::application::memory::{
    build_saved_session_payload, restore_graph_workflow_metadata, restore_session_memory,
};
use crate::domain::types::SessionSnapshot;

use super::common::{session_snapshot_json, snapshot_with_extra};
use crate::control_server::RouterState;

pub(crate) async fn session(State(state): State<Arc<RouterState>>) -> Json<Value> {
    Json(session_snapshot_json(&state))
}

pub(crate) async fn run_mode(State(state): State<Arc<RouterState>>) -> Json<Value> {
    Json(json!(state.session.run_mode_snapshot()))
}
#[derive(Debug, Deserialize)]
pub(crate) struct SavedSessionSaveBody {
    id: Option<String>,
    name: Option<String>,
}
pub(crate) async fn saved_sessions_save(
    State(state): State<Arc<RouterState>>,
    Json(body): Json<SavedSessionSaveBody>,
) -> impl IntoResponse {
    if !state.paths.sessions_configured() {
        return (
            StatusCode::NOT_FOUND,
            Json(crate::control_server::state::saved_sessions_unconfigured()),
        )
            .into_response();
    }
    if !state.paths.memory_configured() {
        return (
            StatusCode::NOT_FOUND,
            Json(crate::control_server::state::memory_unconfigured()),
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

pub(crate) async fn saved_sessions_detail(
    State(state): State<Arc<RouterState>>,
    Path(id): Path<String>,
) -> impl IntoResponse {
    if !state.paths.sessions_configured() {
        return (
            StatusCode::NOT_FOUND,
            Json(crate::control_server::state::saved_sessions_unconfigured()),
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

pub(crate) async fn saved_sessions_open(
    State(state): State<Arc<RouterState>>,
    Path(id): Path<String>,
) -> impl IntoResponse {
    if !state.paths.sessions_configured() {
        return (
            StatusCode::NOT_FOUND,
            Json(crate::control_server::state::saved_sessions_unconfigured()),
        )
            .into_response();
    }
    if !state.paths.memory_configured() {
        return (
            StatusCode::NOT_FOUND,
            Json(crate::control_server::state::memory_unconfigured()),
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
pub(crate) async fn saved_sessions(State(state): State<Arc<RouterState>>) -> impl IntoResponse {
    if !state.paths.sessions_configured() {
        return (
            StatusCode::NOT_FOUND,
            Json(crate::control_server::state::saved_sessions_unconfigured()),
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
