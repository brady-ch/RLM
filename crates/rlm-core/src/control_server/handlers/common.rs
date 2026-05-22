use std::fs;
use std::sync::Arc;

use axum::http::StatusCode;
use axum::response::{IntoResponse, Json};
use serde_json::{json, Value};

use crate::application::execution::InteractiveExecutionSession;
use crate::application::graph::{execute_graph, GraphExecutorInput};
use crate::domain::types::ReplanChoice;
use crate::ports::LanguageModel;

use crate::control_server::RouterState;

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
