use std::sync::Arc;

use axum::extract::{Path, Query, State};
use axum::http::StatusCode;
use axum::response::{IntoResponse, Json};
use serde::Deserialize;
use serde_json::{json, Value};

use super::common::ApiError;
use crate::control_server::RouterState;

#[derive(Debug, Deserialize)]
pub(crate) struct MemoryQuery {
    #[serde(rename = "sessionId")]
    session_id: Option<String>,
    q: Option<String>,
    #[serde(rename = "scopeIds")]
    scope_ids: Option<String>,
    limit: Option<usize>,
}
pub(crate) async fn memory_inspect_payload(
    state: &Arc<RouterState>,
    session_id: &str,
) -> Result<Value, ApiError> {
    if !state.paths.memory_configured() {
        return Err(ApiError {
            status: StatusCode::NOT_FOUND,
            body: crate::control_server::state::memory_unconfigured(),
        });
    }
    let semantic = state.memory_index(session_id).await;
    let snapshot = semantic
        .store()
        .inspect(session_id)
        .map_err(|err| ApiError {
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
pub(crate) struct MemoryPreferenceBody {
    key: Option<String>,
    value: Option<String>,
    lifetime: Option<String>,
}
pub(crate) async fn memory_preferences_set(
    State(state): State<Arc<RouterState>>,
    Json(body): Json<MemoryPreferenceBody>,
) -> Result<Json<Value>, ApiError> {
    if !state.paths.memory_configured() {
        return Err(ApiError {
            status: StatusCode::NOT_FOUND,
            body: crate::control_server::state::memory_unconfigured(),
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
    memory_inspect_payload(&state, &session_id).await.map(Json)
}

pub(crate) async fn memory_preferences_delete(
    State(state): State<Arc<RouterState>>,
    Path(key): Path<String>,
) -> Result<Json<Value>, ApiError> {
    if !state.paths.memory_configured() {
        return Err(ApiError {
            status: StatusCode::NOT_FOUND,
            body: crate::control_server::state::memory_unconfigured(),
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
    memory_inspect_payload(&state, &session_id).await.map(Json)
}
pub(crate) async fn memory(
    State(state): State<Arc<RouterState>>,
    Query(query): Query<MemoryQuery>,
) -> impl IntoResponse {
    if !state.paths.memory_configured() {
        return (
            StatusCode::NOT_FOUND,
            Json(crate::control_server::state::memory_unconfigured()),
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
