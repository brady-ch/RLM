pub mod handlers;
pub mod routes;
pub mod state;

use std::path::PathBuf;
use std::sync::{Arc, Mutex};

use serde_json::Value;
use tokio::sync::Mutex as AsyncMutex;

use crate::adapters::OllamaEmbeddingModel;
use crate::adapters::OllamaLanguageModel;
use crate::application::execution::{InteractiveExecutionSession, ProcessShutdown};
use crate::application::memory::SemanticMemoryIndex;
use crate::model_library::ModelLibraryService;
use crate::persistence::{load_project_config, LoadedProjectConfig, ProjectPaths};
use crate::plugins::{
    build_runtime_context, BuildRuntimeContextInput, PluginRegistryService, RuntimeContext,
};
use crate::ports::{LanguageModel, QueueModel};

#[derive(Clone)]
pub struct RouterState {
    pub ui_dist_dir: Option<PathBuf>,
    pub project_root: PathBuf,
    pub paths: ProjectPaths,
    pub project_config: Option<LoadedProjectConfig>,
    pub memory_session_id: Arc<Mutex<String>>,
    pub session: Arc<InteractiveExecutionSession>,
    pub model_library: Option<Arc<ModelLibraryService>>,
    pub plugin_registry: Option<Arc<PluginRegistryService>>,
    pub runtime_context: Option<RuntimeContext>,
    pub lifecycle: ProcessShutdown,
    memory_index: Arc<AsyncMutex<Option<Arc<SemanticMemoryIndex>>>>,
    plan_model: Arc<dyn LanguageModel>,
    exec_model: Arc<dyn LanguageModel>,
}

impl RouterState {
    pub fn new(project_root: PathBuf) -> Self {
        let paths = ProjectPaths::from_root(project_root.clone());
        let project_config = load_project_config(&project_root, None).ok();
        let (plan_model, exec_model) = resolve_language_models(project_config.as_ref());
        let model_library = project_config.as_ref().and_then(|loaded| {
            loaded.path.as_ref()?;
            resolve_ollama_host(&loaded.config).map(|_| {
                Arc::new(ModelLibraryService::new(
                    project_root.clone(),
                    loaded.config.clone(),
                    resolve_ollama_base_url(&loaded.config),
                ))
            })
        });
        let (plugin_registry, runtime_context) = project_config
            .as_ref()
            .and_then(|loaded| {
                loaded.path.as_ref()?;
                let registry = Arc::new(PluginRegistryService::new(project_root.clone(), loaded));
                let runtime = build_runtime_context(BuildRuntimeContextInput {
                    project_root: &project_root,
                    project_config: Some(&loaded.config),
                    on_init_stage: None,
                })
                .ok();
                Some((Some(registry), runtime))
            })
            .unwrap_or((None, None));
        Self {
            ui_dist_dir: None,
            project_root,
            paths,
            project_config,
            memory_session_id: Arc::new(Mutex::new("default".into())),
            session: InteractiveExecutionSession::new(Default::default()),
            model_library,
            plugin_registry,
            runtime_context,
            lifecycle: ProcessShutdown::default(),
            memory_index: Arc::new(AsyncMutex::new(None)),
            plan_model,
            exec_model,
        }
    }

    pub async fn memory_index(&self, session_id: &str) -> Arc<SemanticMemoryIndex> {
        let mut guard = self.memory_index.lock().await;
        let needs_new = guard
            .as_ref()
            .is_none_or(|index| index.session_id() != session_id);
        if needs_new {
            *guard = Some(Arc::new(SemanticMemoryIndex::new(
                session_id,
                self.paths.memory_dir.clone(),
                OllamaEmbeddingModel::default(),
                self.lifecycle.clone(),
            )));
        }
        guard.as_ref().expect("memory index initialized").clone()
    }

    /// Cancel background work, stop execution, and release in-memory vector index state.
    pub async fn shutdown(&self, reason: &str) {
        self.lifecycle.shutdown(reason);
        self.session.stop(reason);
        let mut guard = self.memory_index.lock().await;
        if let Some(index) = guard.take() {
            index.release_memory().await;
        }
    }

    pub fn plan_model(&self) -> Arc<dyn LanguageModel> {
        Arc::clone(&self.plan_model)
    }

    pub fn exec_model(&self) -> Arc<dyn LanguageModel> {
        Arc::clone(&self.exec_model)
    }

    pub fn runtime_config(&self) -> crate::domain::types::RecursiveModelConfig {
        runtime_config_from_config(self.project_config.as_ref().map(|loaded| &loaded.config))
    }

    pub fn with_ui_dist(mut self, ui_dist_dir: Option<PathBuf>) -> Self {
        self.ui_dist_dir = ui_dist_dir;
        self
    }

    pub fn with_memory_session_id(self, session_id: impl Into<String>) -> Self {
        *self.memory_session_id.lock().expect("memory_session_id") = session_id.into();
        self
    }

    pub fn set_memory_session_id(&self, session_id: impl Into<String>) {
        *self.memory_session_id.lock().expect("memory_session_id") = session_id.into();
    }

    pub fn current_memory_session_id(&self) -> String {
        self.memory_session_id
            .lock()
            .expect("memory_session_id")
            .clone()
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

    pub fn with_model_library(mut self, model_library: Option<Arc<ModelLibraryService>>) -> Self {
        self.model_library = model_library;
        self
    }

    pub fn with_plugin_registry(mut self, registry: Option<Arc<PluginRegistryService>>) -> Self {
        self.plugin_registry = registry;
        self
    }

    pub fn with_runtime_context(mut self, runtime: Option<RuntimeContext>) -> Self {
        self.runtime_context = runtime;
        self
    }

    pub fn runtime_tools(&self) -> Vec<std::sync::Arc<dyn crate::ports::Tool>> {
        self.runtime_context
            .as_ref()
            .map(|ctx| ctx.tools.clone())
            .unwrap_or_default()
    }
}

pub fn runtime_config_from_config(
    config: Option<&Value>,
) -> crate::domain::types::RecursiveModelConfig {
    config
        .and_then(|loaded| loaded.get("runtime"))
        .and_then(|rt| serde_json::from_value(rt.clone()).ok())
        .unwrap_or(crate::domain::types::RecursiveModelConfig {
            max_depth: Some(2),
            max_dynamic_depth: 2,
            max_branches: 4,
            max_prompt_characters: 4096,
            max_model_calls: 50,
            max_tool_rounds: 8,
            quality_loop: None,
        })
}

pub fn resolve_language_models(
    project_config: Option<&LoadedProjectConfig>,
) -> (Arc<dyn LanguageModel>, Arc<dyn LanguageModel>) {
    let Some(loaded) = project_config else {
        return default_queue_models();
    };
    let Some((base_url, allow_unconstrained)) = resolve_ollama_host(&loaded.config) else {
        return default_queue_models();
    };
    let plan_name = tier_model_name(&loaded.config, "medium")
        .or_else(|| default_model_name(&loaded.config))
        .unwrap_or_else(|| "granite4.1:3b".to_string());
    let exec_name = default_model_name(&loaded.config).unwrap_or_else(|| plan_name.clone());
    (
        Arc::new(OllamaLanguageModel::new(
            Some(&base_url),
            Some(&plan_name),
            allow_unconstrained,
        )) as Arc<dyn LanguageModel>,
        Arc::new(OllamaLanguageModel::new(
            Some(&base_url),
            Some(&exec_name),
            allow_unconstrained,
        )) as Arc<dyn LanguageModel>,
    )
}

pub fn default_queue_models() -> (Arc<dyn LanguageModel>, Arc<dyn LanguageModel>) {
    (
        Arc::new(QueueModel::new([
            r#"{"children":[{"label":"Step","prompt":"Child task","type":"AI","complexity":"low","agentId":"default","runtime":"single-pass"}]}"#,
        ])) as Arc<dyn LanguageModel>,
        Arc::new(QueueModel::new(["done"])) as Arc<dyn LanguageModel>,
    )
}

fn resolve_ollama_host(config: &Value) -> Option<(String, bool)> {
    let host_id = config.get("runtimeHost").and_then(Value::as_str)?;
    let host = config.get("hosts")?.get(host_id)?;
    if host.get("kind").and_then(Value::as_str) != Some("ollama") {
        return None;
    }
    let base_url = host
        .get("baseUrl")
        .and_then(Value::as_str)
        .unwrap_or("http://127.0.0.1:11434")
        .to_string();
    let allow_unconstrained = host
        .get("allowUnconstrainedToolCalls")
        .and_then(Value::as_bool)
        .unwrap_or(false);
    Some((base_url, allow_unconstrained))
}

pub fn resolve_ollama_base_url(config: &Value) -> String {
    resolve_ollama_host(config)
        .map(|(base, _)| base)
        .unwrap_or_else(|| "http://127.0.0.1:11434".to_string())
}

fn tier_model_name(config: &Value, tier: &str) -> Option<String> {
    config
        .pointer("/models/tiers")
        .and_then(|tiers| tiers.get(tier))
        .and_then(|doc| doc.get("name"))
        .and_then(Value::as_str)
        .map(str::to_string)
}

fn default_model_name(config: &Value) -> Option<String> {
    config
        .get("models")
        .and_then(|models| models.get("default"))
        .and_then(Value::as_str)
        .map(str::to_string)
}

pub fn build_router(state: Arc<RouterState>) -> axum::Router {
    routes::build_router(state)
}
