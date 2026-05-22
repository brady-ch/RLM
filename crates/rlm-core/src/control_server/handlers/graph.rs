use std::sync::Arc;
use axum::http::StatusCode;

use axum::extract::State;
use axum::response::Json;
use serde_json::{json, Value};

use crate::domain::types::{GraphPosition, GraphViewport};

use super::common::ApiError;
use crate::control_server::RouterState;

pub(crate) async fn graph_snapshot(State(state): State<Arc<RouterState>>) -> Json<Value> {
    Json(json!(state.session.snapshot().graph))
}

pub(crate) async fn graph_layout(
    State(state): State<Arc<RouterState>>,
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

pub(crate) async fn graph_viewport(State(state): State<Arc<RouterState>>, body: Json<Value>) -> Json<Value> {
    state.session.set_graph_viewport(GraphViewport {
        x: body.get("x").and_then(|v| v.as_f64()).unwrap_or(0.0),
        y: body.get("y").and_then(|v| v.as_f64()).unwrap_or(0.0),
        zoom: body.get("zoom").and_then(|v| v.as_f64()).unwrap_or(1.0),
    });
    Json(json!(state.session.snapshot()))
}
