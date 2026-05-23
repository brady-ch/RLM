use std::fs;
use std::sync::Arc;

use axum::http::StatusCode;
use axum::response::{IntoResponse, Json};
use serde_json::{json, Value};

use crate::application::execution::InteractiveExecutionSession;
use crate::application::graph::{execute_graph, GraphExecutorInput};
use crate::application::memory::{ollama_loaded_ram_mb, resource_guard_json, unload_ollama_models, configured_model_names};
use crate::control_server::resolve_ollama_base_url;
use crate::domain::run_state_types::ResumeCursor;
use crate::domain::types::ReplanChoice;
use crate::domain::RunStatePersistence;
use crate::ports::{LanguageModel, RunStateStorePort};

use crate::control_server::RouterState;

pub(crate) fn session_snapshot_json(state: &Arc<RouterState>) -> Value {
    session_snapshot_json_with_loaded_mb(state, None)
}

pub(crate) async fn session_snapshot_json_async(state: &Arc<RouterState>) -> Value {
    let loaded_mb = if let Some(loaded) = state.project_config.as_ref() {
        let base_url = resolve_ollama_base_url(&loaded.config);
        let client = reqwest::Client::new();
        ollama_loaded_ram_mb(&base_url, &client).await
    } else {
        0
    };
    session_snapshot_json_with_loaded_mb(state, Some(loaded_mb))
}

fn session_snapshot_json_with_loaded_mb(state: &Arc<RouterState>, ollama_loaded_mb: Option<u32>) -> Value {
    let mut snap = serde_json::to_value(state.session.snapshot()).unwrap_or(json!({}));
    let run_state = if state.session.is_confirmed_execution_running() {
        json!({ "resumable": false })
    } else {
        run_state_resumable_json(state)
    };
    if let Some(obj) = snap.as_object_mut() {
        obj.insert("runState".into(), run_state);
        if let Some(loaded) = state.project_config.as_ref() {
            obj.insert(
                "resourceGuard".into(),
                resource_guard_json(&loaded.config, ollama_loaded_mb.unwrap_or(0)),
            );
        }
    }
    snap
}

pub(crate) async fn unload_session_models(state: &Arc<RouterState>) {
    let Some(loaded) = state.project_config.as_ref() else {
        return;
    };
    let base_url = resolve_ollama_base_url(&loaded.config);
    let models = configured_model_names(&loaded.config);
    if models.is_empty() {
        return;
    }
    let client = reqwest::Client::new();
    unload_ollama_models(&base_url, &models, &client).await;
}

fn run_state_resumable_json(state: &Arc<RouterState>) -> Value {
    let run_state_dir = &state.paths.run_state_dir;
    if !run_state_dir.is_dir() {
        return json!({ "resumable": false });
    }

    let run_id = state.current_memory_session_id();
    let store: Arc<dyn RunStateStorePort> = Arc::new(crate::persistence::FileRunStateStore::new(
        run_state_dir.clone(),
    ));
    let persistence = RunStatePersistence::new(run_id, store);

    let Ok(Some(snapshot)) = persistence.get_snapshot() else {
        return json!({ "resumable": false });
    };
    if snapshot.resume_cursor.is_none() {
        return json!({ "resumable": false });
    }

    let mut run_state = json!({ "resumable": true });
    if let Some(cursor_value) = snapshot.resume_cursor.as_ref() {
        if let Ok(cursor) = serde_json::from_value::<ResumeCursor>(cursor_value.clone()) {
            if let Some(obj) = run_state.as_object_mut() {
                obj.insert("activeNodeId".into(), json!(cursor.active_node_id));
            }
        }
    }
    run_state
}

pub(crate) fn snapshot_with_extra(session: &InteractiveExecutionSession, extra: Value) -> Value {
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

pub(crate) fn spawn_graph_execution(state: &Arc<RouterState>, resume: bool) {
    let session = Arc::clone(&state.session);
    state.session.begin_confirmed_execution();
    let runtime_config = state.runtime_config();
    let project_config = state
        .project_config
        .as_ref()
        .map(|loaded| loaded.config.clone());
    let exec_model = state.exec_model();
    let run_state = if state.paths.run_state_dir.is_dir()
        || fs::create_dir_all(&state.paths.run_state_dir).is_ok()
    {
        let store: Arc<dyn crate::ports::RunStateStorePort> = Arc::new(
            crate::persistence::FileRunStateStore::new(state.paths.run_state_dir.clone()),
        );
        Some(Arc::new(crate::domain::RunStatePersistence::new(
            state.current_memory_session_id(),
            store,
        )))
    } else {
        None
    };
    let input = GraphExecutorInput {
        runtime_config,
        project_config,
        create_model: Arc::new(move || Arc::clone(&exec_model) as Arc<dyn LanguageModel>),
        runtime: state.runtime_context.clone(),
        run_state,
        resume,
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

pub(crate) fn parse_replan(value: Option<&Value>) -> Option<ReplanChoice> {
    match value.and_then(|v| v.as_str()) {
        Some("replace") => Some(ReplanChoice::Replace),
        Some("merge") => Some(ReplanChoice::Merge),
        Some("cancel") => Some(ReplanChoice::Cancel),
        _ => None,
    }
}
pub(crate) struct ApiError {
    pub status: StatusCode,
    pub body: Value,
}

impl ApiError {
    pub(crate) fn from_plain(err: String) -> Self {
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

    pub(crate) fn from_mutation(err: String) -> Self {
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
