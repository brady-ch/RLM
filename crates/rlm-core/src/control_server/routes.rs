use axum::{
    extract::State,
    http::StatusCode,
    response::{Html, IntoResponse, Json, Sse},
    routing::get,
    Router,
};
use axum::response::sse::{Event, KeepAlive};
use futures::stream::{self, StreamExt};
use tower_http::services::ServeDir;

use super::state;
use super::RouterState;

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
        Some(dist) => Router::new().fallback_service(
            ServeDir::new(dist).append_index_html_on_directories(true),
        ),
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
    Json(
        snap.get("graph")
            .cloned()
            .unwrap_or(serde_json::json!({})),
    )
}

async fn saved_sessions(State(_): State<RouterState>) -> impl IntoResponse {
    (
        StatusCode::NOT_FOUND,
        Json(state::saved_sessions_unconfigured()),
    )
}

async fn graph_workflows(State(_): State<RouterState>) -> Json<serde_json::Value> {
    Json(state::graph_workflows_empty())
}

async fn memory(State(_): State<RouterState>) -> impl IntoResponse {
    (StatusCode::NOT_FOUND, Json(state::memory_unconfigured()))
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

async fn events(State(_): State<RouterState>) -> Sse<impl StreamExt<Item = Result<Event, std::convert::Infallible>>> {
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
