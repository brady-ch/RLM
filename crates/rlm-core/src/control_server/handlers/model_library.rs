use std::sync::Arc;

use axum::extract::State;
use axum::http::StatusCode;
use axum::response::{IntoResponse, Json};
use serde::Deserialize;
use serde_json::json;

use crate::control_server::RouterState;

pub(crate) async fn model_library(State(state): State<Arc<RouterState>>) -> impl IntoResponse {
    let Some(library) = state.model_library.as_ref() else {
        return (
            StatusCode::NOT_FOUND,
            Json(crate::control_server::state::model_library_unconfigured()),
        )
            .into_response();
    };
    Json(library.snapshot().await).into_response()
}

pub(crate) async fn model_library_search(
    State(state): State<Arc<RouterState>>,
    axum::extract::Query(query): axum::extract::Query<ModelLibrarySearchQuery>,
) -> impl IntoResponse {
    let Some(library) = state.model_library.as_ref() else {
        return (
            StatusCode::NOT_FOUND,
            Json(crate::control_server::state::model_library_unconfigured()),
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
pub(crate) struct ModelLibrarySearchQuery {
    q: Option<String>,
}

#[derive(Debug, Deserialize)]
pub(crate) struct ModelLibraryInstallBody {
    model: Option<String>,
}

pub(crate) async fn model_library_install(
    State(state): State<Arc<RouterState>>,
    Json(body): Json<ModelLibraryInstallBody>,
) -> impl IntoResponse {
    let Some(library) = state.model_library.as_ref() else {
        return (
            StatusCode::NOT_FOUND,
            Json(crate::control_server::state::model_library_unconfigured()),
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
pub(crate) struct ModelLibraryDownloadBody {
    model: Option<String>,
    file: Option<String>,
}

pub(crate) async fn model_library_download(
    State(state): State<Arc<RouterState>>,
    Json(body): Json<ModelLibraryDownloadBody>,
) -> impl IntoResponse {
    let Some(library) = state.model_library.as_ref() else {
        return (
            StatusCode::NOT_FOUND,
            Json(crate::control_server::state::model_library_unconfigured()),
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
pub(crate) struct ModelLibrarySelectTierBody {
    tier: Option<String>,
    model: Option<String>,
}

pub(crate) async fn model_library_select_tier(
    State(state): State<Arc<RouterState>>,
    Json(body): Json<ModelLibrarySelectTierBody>,
) -> impl IntoResponse {
    let Some(library) = state.model_library.as_ref() else {
        return (
            StatusCode::NOT_FOUND,
            Json(crate::control_server::state::model_library_unconfigured()),
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
