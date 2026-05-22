use std::any::Any;
use std::path::{Path, PathBuf};
use std::sync::Arc;

use crate::control_server::{resolve_language_models, runtime_config_from_config};
use crate::domain::types::RecursiveModelConfig;
use crate::persistence::{load_project_config, LoadedProjectConfig};
use crate::plugins::{build_runtime_context, BuildRuntimeContextInput, RuntimeContext};
use crate::ports::{LanguageModel, QueueModel};

pub struct CliAskRuntime {
    pub project_root: PathBuf,
    pub project_config: LoadedProjectConfig,
    pub runtime_context: RuntimeContext,
    pub exec_model: Arc<dyn LanguageModel>,
    pub runtime_config: RecursiveModelConfig,
}

pub fn prepare_ask_execution(
    project_root: &Path,
    config_path: Option<&Path>,
) -> Result<CliAskRuntime, String> {
    let project_config = load_project_config(project_root, config_path)
        .map_err(|err| format!("Failed to load project config: {err}"))?;

    let runtime_context = build_runtime_context(BuildRuntimeContextInput {
        project_root,
        project_config: Some(&project_config.config),
        on_init_stage: None,
    })?;

    let (_plan_model, exec_model) = resolve_language_models(Some(&project_config));
    if !model_is_actionable(&project_config, &exec_model) {
        return Err(
            "No reachable model host configured. Set runtimeHost to an Ollama host in rlm.config.yaml or use RLM_RUNTIME=node.".into(),
        );
    }

    let runtime_config = runtime_config_from_config(Some(&project_config.config));

    Ok(CliAskRuntime {
        project_root: project_root.to_path_buf(),
        project_config,
        runtime_context,
        exec_model,
        runtime_config,
    })
}

fn model_is_actionable(loaded: &LoadedProjectConfig, exec_model: &Arc<dyn LanguageModel>) -> bool {
    if loaded.path.is_none() {
        return true;
    }
    exec_model.as_ref().type_id() != std::any::TypeId::of::<QueueModel>()
}
