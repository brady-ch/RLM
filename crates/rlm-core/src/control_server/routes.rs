use axum::response::sse::{Event, KeepAlive};
use axum::{
    extract::{Query, State},
    http::StatusCode,
    response::{Html, IntoResponse, Json, Sse},
    routing::get,
    Router,
};
use futures::stream::{self, StreamExt};
use serde::Deserialize;
use serde_json::json;
use tower_http::services::ServeDir;

use crate::persistence::{FileMemoryStore, FileSessionStore};

use super::state;
use super::RouterState;

#[derive(Debug, Deserialize)]
struct MemoryQuery {
    #[serde(rename = "sessionId")]
    session_id: Option<String>,
}

pub fn build_router(state: RouterState) -> Router {
    let api = Router::new()
        .route("/api/session", get(session))
        .route("/api/run-mode", get(run_mode))
        .route("/api/graph", get(graph))
        .route("/api/saved-sessions", get(saved_sessions))
        .route("/api/graph-workflows", get(graph_workflows))
        .route("/api/memory", get(memory))
        .route("/api/model-library", get(model_library))
        .route("/api/plugins", get(plugins_list))
        .route("/api/events", get(events));

    let ui = match state.ui_dist_dir.clone() {
        Some(dist) => Router::new()
            .fallback_service(ServeDir::new(dist).append_index_html_on_directories(true)),
        None => Router::new().fallback(get(ui_placeholder)),
    };

    api.merge(ui).with_state(state)
}

async fn session(State(_): State<RouterState>) -> Json<serde_json::Value> {
    Json(state::idle_session_snapshot())
}

async fn run_mode(State(_): State<RouterState>) -> Json<serde_json::Value> {
    Json(state::idle_run_mode())
}

async fn graph(State(_): State<RouterState>) -> Json<serde_json::Value> {
    let snap = state::idle_session_snapshot();
    Json(snap.get("graph").cloned().unwrap_or(serde_json::json!({})))
}

async fn saved_sessions(State(state): State<RouterState>) -> impl IntoResponse {
    if !state.paths.sessions_configured() {
        return (
            StatusCode::NOT_FOUND,
            Json(state::saved_sessions_unconfigured()),
        )
            .into_response();
    }

    let store = FileSessionStore::new(state.paths.sessions_dir.clone());
    match store.list() {
        Ok(sessions) => (StatusCode::OK, Json(json!({ "sessions": sessions }))).into_response(),
        Err(err) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": err.to_string() })),
        )
            .into_response(),
    }
}

async fn graph_workflows(State(_): State<RouterState>) -> Json<serde_json::Value> {
    Json(state::graph_workflows_empty())
}

async fn memory(
    State(state): State<RouterState>,
    Query(query): Query<MemoryQuery>,
) -> impl IntoResponse {
    if !state.paths.memory_configured() {
        return (StatusCode::NOT_FOUND, Json(state::memory_unconfigured())).into_response();
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
        Json(state::model_library_unconfigured()),
    )
}

async fn plugins_list(State(_): State<RouterState>) -> Json<serde_json::Value> {
    Json(state::plugins_list_empty())
}

async fn events(
    State(_): State<RouterState>,
) -> Sse<impl StreamExt<Item = Result<Event, std::convert::Infallible>>> {
    let snapshot = state::idle_session_snapshot();
    let initial = Event::default()
        .event("snapshot")
        .data(snapshot.to_string());
    let stream = stream::once(async move { Ok(initial) }).chain(futures::stream::pending());
    Sse::new(stream).keep_alive(KeepAlive::default())
}

async fn ui_placeholder() -> Html<&'static str> {
    Html("<!doctype html><title>RLM UI</title><div id=\"root\">Build the React UI with npm run build:ui.</div>")
}
