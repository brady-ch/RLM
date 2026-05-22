use std::sync::Arc;

use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::response::{IntoResponse, Json};
use serde::Deserialize;
use serde_json::json;

use crate::control_server::RouterState;

pub(crate) async fn plugins_list(State(state): State<Arc<RouterState>>) -> impl IntoResponse {
    let Some(registry) = state.plugin_registry.as_ref() else {
        return Json(crate::control_server::state::plugins_list_empty()).into_response();
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

pub(crate) async fn plugins_doctor(State(state): State<Arc<RouterState>>) -> impl IntoResponse {
    let Some(registry) = state.plugin_registry.as_ref() else {
        return (
            StatusCode::NOT_FOUND,
            Json(json!({ "error": "Plugin registry is not configured." })),
        )
            .into_response();
    };
    match registry.doctor(false).await {
        Ok(mut result) => {
            if let Some(runtime) = state.runtime_context.as_ref() {
                for warning in &runtime.interop_warnings {
                    result.issues.push(crate::plugins::PluginDoctorIssue {
                        code: "mcp_not_connected".into(),
                        severity: "warn".into(),
                        message: warning.clone(),
                        plugin_id: None,
                        path: None,
                    });
                }
            }
            Json(serde_json::to_value(result).unwrap_or(json!({}))).into_response()
        }
        Err(err) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": err })),
        )
            .into_response(),
    }
}

pub(crate) async fn plugins_doctor_fix(State(state): State<Arc<RouterState>>) -> impl IntoResponse {
    let Some(registry) = state.plugin_registry.as_ref() else {
        return (
            StatusCode::NOT_FOUND,
            Json(json!({ "error": "Plugin registry is not configured." })),
        )
            .into_response();
    };
    match registry.doctor(true).await {
        Ok(mut result) => {
            if let Some(runtime) = state.runtime_context.as_ref() {
                for warning in &runtime.interop_warnings {
                    result.issues.push(crate::plugins::PluginDoctorIssue {
                        code: "mcp_not_connected".into(),
                        severity: "warn".into(),
                        message: warning.clone(),
                        plugin_id: None,
                        path: None,
                    });
                }
            }
            Json(serde_json::to_value(result).unwrap_or(json!({}))).into_response()
        }
        Err(err) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": err })),
        )
            .into_response(),
    }
}

#[derive(Debug, Deserialize)]
pub(crate) struct PluginInstallBody {
    path: Option<String>,
    source: Option<String>,
    url: Option<String>,
    confirm: Option<bool>,
    yes: Option<bool>,
}

pub(crate) async fn plugins_install(
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
pub(crate) struct PluginIdBody {
    id: Option<String>,
}

pub(crate) async fn plugins_enable(
    State(state): State<Arc<RouterState>>,
    Json(body): Json<PluginIdBody>,
) -> impl IntoResponse {
    plugin_id_mutation(state, body.id, |registry, id| async move {
        registry.enable(&id).await
    })
    .await
}

pub(crate) async fn plugins_disable(
    State(state): State<Arc<RouterState>>,
    Json(body): Json<PluginIdBody>,
) -> impl IntoResponse {
    plugin_id_mutation(state, body.id, |registry, id| async move {
        registry.disable(&id).await
    })
    .await
}

pub(crate) async fn plugins_uninstall(
    State(state): State<Arc<RouterState>>,
    Json(body): Json<PluginIdBody>,
) -> impl IntoResponse {
    plugin_id_mutation(state, body.id, |registry, id| async move {
        registry.uninstall(&id).await
    })
    .await
}

pub(crate) async fn plugin_id_mutation<F, Fut>(
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
pub(crate) struct PluginValidateBody {
    path: Option<String>,
}

pub(crate) async fn plugins_validate(
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

pub(crate) async fn plugins_inspect(
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
