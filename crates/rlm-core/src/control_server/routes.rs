use std::sync::Arc;

use axum::routing::{delete, get, post};
use axum::Router;

use super::handlers::{
    chat, events, graph, memory, model_library, nodes, plugins, session, static_ui, workflows,
};
use super::RouterState;

pub fn build_router(state: Arc<RouterState>) -> Router {
    let api = Router::new()
        .route("/api/session", get(session::session))
        .route("/api/run-mode", get(session::run_mode))
        .route("/api/graph", get(graph::graph_snapshot))
        .route("/api/graph/layout", post(graph::graph_layout))
        .route("/api/graph/viewport", post(graph::graph_viewport))
        .route("/api/saved-sessions", get(session::saved_sessions))
        .route(
            "/api/saved-sessions/save",
            post(session::saved_sessions_save),
        )
        .route(
            "/api/saved-sessions/{id}",
            get(session::saved_sessions_detail),
        )
        .route(
            "/api/saved-sessions/{id}/open",
            post(session::saved_sessions_open),
        )
        .route("/api/graph-workflows", get(workflows::graph_workflows_list))
        .route(
            "/api/graph-workflows/export",
            post(workflows::graph_workflows_export),
        )
        .route(
            "/api/graph-workflows/import",
            post(workflows::graph_workflows_import),
        )
        .route("/api/memory", get(memory::memory))
        .route(
            "/api/memory/preferences",
            post(memory::memory_preferences_set),
        )
        .route(
            "/api/memory/preferences/{key}",
            delete(memory::memory_preferences_delete),
        )
        .route("/api/model-library", get(model_library::model_library))
        .route(
            "/api/model-library/search",
            get(model_library::model_library_search),
        )
        .route(
            "/api/model-library/install",
            post(model_library::model_library_install),
        )
        .route(
            "/api/model-library/download",
            post(model_library::model_library_download),
        )
        .route(
            "/api/model-library/select-tier",
            post(model_library::model_library_select_tier),
        )
        .route("/api/plugins", get(plugins::plugins_list))
        .route("/api/plugins/doctor", get(plugins::plugins_doctor))
        .route("/api/plugins/doctor/fix", post(plugins::plugins_doctor_fix))
        .route("/api/plugins/install", post(plugins::plugins_install))
        .route("/api/plugins/enable", post(plugins::plugins_enable))
        .route("/api/plugins/disable", post(plugins::plugins_disable))
        .route("/api/plugins/uninstall", post(plugins::plugins_uninstall))
        .route("/api/plugins/validate", post(plugins::plugins_validate))
        .route(
            "/api/plugins/{plugin_id}/inspect",
            get(plugins::plugins_inspect),
        )
        .route("/api/events", get(events::events))
        .route("/api/nodes/add", post(nodes::nodes_add))
        .route("/api/nodes/{node_id}/edit", post(nodes::nodes_edit))
        .route("/api/nodes/{node_id}/model", post(nodes::nodes_model))
        .route("/api/nodes/{node_id}/sampling", post(nodes::nodes_sampling))
        .route("/api/nodes/{node_id}/expert", post(nodes::nodes_expert))
        .route("/api/nodes/{node_id}/plan", post(nodes::nodes_plan))
        .route(
            "/api/nodes/{node_id}/breakdown",
            post(nodes::nodes_breakdown),
        )
        .route(
            "/api/nodes/{node_id}/extend-budget",
            post(nodes::nodes_extend_budget),
        )
        .route("/api/nodes/{node_id}/approve", post(nodes::nodes_approve))
        .route("/api/nodes/{node_id}/skip", post(nodes::nodes_skip))
        .route(
            "/api/nodes/{node_id}/quality-loop/accept",
            post(nodes::nodes_quality_accept),
        )
        .route(
            "/api/nodes/{node_id}/quality-loop/stop",
            post(nodes::nodes_quality_stop),
        )
        .route("/api/nodes/{node_id}/connect", post(nodes::nodes_connect))
        .route("/api/nodes/{node_id}/delete", post(nodes::nodes_delete))
        .route("/api/chat/message", post(chat::chat_message))
        .route("/api/chat/apply", post(chat::chat_apply))
        .route("/api/chat/cancel", post(chat::chat_cancel))
        .route("/api/chat/confirm-run", post(chat::chat_confirm_run))
        .route("/api/chat/resume-run", post(chat::chat_resume_run))
        .route("/api/stop", post(chat::stop_run))
        .route(
            "/api/clarifications/answer",
            post(chat::clarifications_answer),
        )
        .route(
            "/api/clarifications/abort",
            post(chat::clarifications_abort),
        )
        .route(
            "/api/pause-future-auto-approvals",
            post(chat::pause_auto_approvals),
        );

    let ui = match state.ui_dist_dir.clone() {
        Some(dist) => Router::new().fallback_service(
            tower_http::services::ServeDir::new(dist).append_index_html_on_directories(true),
        ),
        None => Router::new().fallback(get(static_ui::ui_placeholder)),
    };

    api.merge(ui).with_state(state)
}
