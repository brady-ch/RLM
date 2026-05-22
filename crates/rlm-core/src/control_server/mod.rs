pub mod routes;
pub mod state;

use std::path::PathBuf;
use std::sync::Arc;

use axum::Router;

use crate::execution::InteractiveExecutionSession;
use crate::persistence::{load_project_config, LoadedProjectConfig, ProjectPaths};

#[derive(Clone)]
pub struct RouterState {
    pub ui_dist_dir: Option<PathBuf>,
    pub project_root: PathBuf,
    pub paths: ProjectPaths,
    pub project_config: Option<LoadedProjectConfig>,
    pub memory_session_id: String,
    pub session: Arc<InteractiveExecutionSession>,
}

impl RouterState {
    pub fn new(project_root: PathBuf) -> Self {
        let paths = ProjectPaths::from_root(project_root.clone());
        let project_config = load_project_config(&project_root, None).ok();
        Self {
            ui_dist_dir: None,
            project_root,
            paths,
            project_config,
            memory_session_id: "default".into(),
            session: InteractiveExecutionSession::new(Default::default()),
        }
    }

    pub fn with_ui_dist(mut self, ui_dist_dir: Option<PathBuf>) -> Self {
        self.ui_dist_dir = ui_dist_dir;
        self
    }

    pub fn with_memory_session_id(mut self, session_id: impl Into<String>) -> Self {
        self.memory_session_id = session_id.into();
        self
    }

    pub fn with_session(mut self, session: Arc<InteractiveExecutionSession>) -> Self {
        self.session = session;
        self
    }
}

pub fn build_router(state: RouterState) -> Router {
    routes::build_router(state)
}
