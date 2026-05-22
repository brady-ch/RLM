use serde_json::{json, Value};

/// Idle session snapshot matching golden fixture `session-idle.json`.
pub fn idle_session_snapshot() -> Value {
    json!({
        "graph": {
            "nodes": [],
            "edges": [],
            "viewport": { "x": 0.0, "y": 0.0, "zoom": 1.0 }
        },
        "status": "planned",
        "approvalMode": "full",
        "autoApprovalPaused": false,
        "chat": {
            "readiness": {
                "state": "draft",
                "reason": "Draft graph: confirm graph and run to start execution."
            },
            "clarificationHistory": []
        }
    })
}

pub fn idle_run_mode() -> Value {
    json!({
        "approvalMode": "full",
        "approvalModeLabel": "Full checkpoints",
        "autoApprovalPaused": false
    })
}

pub fn saved_sessions_unconfigured() -> Value {
    json!({ "error": "Saved sessions are not configured." })
}

pub fn memory_unconfigured() -> Value {
    json!({ "error": "Memory inspection is not configured." })
}

pub fn graph_workflows_empty() -> Value {
    json!({ "workflows": [] })
}

pub fn model_library_unconfigured() -> Value {
    json!({ "error": "Model library is not configured." })
}

pub fn plugins_list_empty() -> Value {
    json!({ "plugins": [] })
}
