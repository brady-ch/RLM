pub mod routes;
pub mod state;

use std::path::PathBuf;
use std::sync::Arc;

use axum::Router;

use crate::domain::types::RecursiveModelConfig;
use crate::execution::InteractiveExecutionSession;
use crate::persistence::{load_project_config, LoadedProjectConfig, ProjectPaths};
use crate::ports::{LanguageModel, QueueModel};

#[derive(Clone)]
pub struct RouterState {
    pub ui_dist_dir: Option<PathBuf>,
    pub project_root: PathBuf,
    pub paths: ProjectPaths,
    pub project_config: Option<LoadedProjectConfig>,
    pub memory_session_id: String,
    pub session: Arc<InteractiveExecutionSession>,
    plan_model: Arc<dyn LanguageModel>,
    exec_model: Arc<dyn LanguageModel>,
}

impl RouterState {
    pub fn new(project_root: PathBuf) -> Self {
        let paths = ProjectPaths::from_root(project_root.clone());
        let project_config = load_project_config(&project_root, None).ok();
        let plan_model = Arc::new(QueueModel::new([
            r#"{"children":[{"label":"Step","prompt":"Child task","type":"AI","complexity":"low","agentId":"default","runtime":"single-pass"}]}"#,
        ])) as Arc<dyn LanguageModel>;
        let exec_model = Arc::new(QueueModel::new(["done"])) as Arc<dyn LanguageModel>;
        Self {
            ui_dist_dir: None,
            project_root,
            paths,
            project_config,
            memory_session_id: "default".into(),
            session: InteractiveExecutionSession::new(Default::default()),
            plan_model,
            exec_model,
        }
    }

    pub fn plan_model(&self) -> Arc<dyn LanguageModel> {
        Arc::clone(&self.plan_model)
    }

    pub fn exec_model(&self) -> Arc<dyn LanguageModel> {
        Arc::clone(&self.exec_model)
    }

    pub fn runtime_config(&self) -> RecursiveModelConfig {
        self.project_config
            .as_ref()
            .and_then(|loaded| loaded.config.get("runtime"))
            .and_then(|rt| serde_json::from_value(rt.clone()).ok())
            .unwrap_or(RecursiveModelConfig {
                max_depth: Some(2),
                max_dynamic_depth: 2,
                max_branches: 4,
                max_prompt_characters: 4096,
                max_model_calls: 50,
                max_tool_rounds: 8,
                quality_loop: None,
            })
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

    pub fn with_plan_model(mut self, model: Arc<dyn LanguageModel>) -> Self {
        self.plan_model = model;
        self
    }

    pub fn with_exec_model(mut self, model: Arc<dyn LanguageModel>) -> Self {
        self.exec_model = model;
        self
    }
}

pub fn build_router(state: RouterState) -> Router {
    routes::build_router(state)
}
