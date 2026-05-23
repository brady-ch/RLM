use std::any::Any;
use std::path::{Path, PathBuf};
use std::sync::Arc;

use crate::application::execution::CancellationController;
use crate::control_server::{
    default_queue_models, resolve_language_models, runtime_config_from_config,
};
use crate::domain::types::{QualityLoopBudgetBehavior, QualityLoopConfig, RecursiveModelConfig};
use crate::persistence::{load_project_config, LoadedProjectConfig};
use crate::plugins::{build_runtime_context, BuildRuntimeContextInput, RuntimeContext};
use crate::ports::{LanguageModel, QueueModel};

#[derive(Debug, Clone, Default)]
pub struct CliConfigOverrides {
    pub max_depth: Option<i32>,
    pub max_dynamic_depth: Option<i32>,
    pub max_branches: Option<i32>,
    pub max_prompt_characters: Option<usize>,
    pub max_model_calls: Option<u32>,
    pub max_tool_rounds: Option<u32>,
    pub quality_loop: bool,
    pub quality_loop_max_iterations: Option<u32>,
}

pub struct CliRuntime {
    pub project_root: PathBuf,
    pub project_config: LoadedProjectConfig,
    pub runtime_context: RuntimeContext,
    pub plan_model: Arc<dyn LanguageModel>,
    pub exec_model: Arc<dyn LanguageModel>,
    pub runtime_config: RecursiveModelConfig,
}

pub type CliAskRuntime = CliRuntime;

pub fn apply_config_overrides(
    mut base: RecursiveModelConfig,
    overrides: &CliConfigOverrides,
) -> RecursiveModelConfig {
    if let Some(value) = overrides.max_depth {
        base.max_depth = Some(value);
    }
    if let Some(value) = overrides.max_dynamic_depth {
        base.max_dynamic_depth = value;
    }
    if let Some(value) = overrides.max_branches {
        base.max_branches = value;
    }
    if let Some(value) = overrides.max_prompt_characters {
        base.max_prompt_characters = value;
    }
    if let Some(value) = overrides.max_model_calls {
        base.max_model_calls = value;
    }
    if let Some(value) = overrides.max_tool_rounds {
        base.max_tool_rounds = value;
    }
    if overrides.quality_loop || overrides.quality_loop_max_iterations.is_some() {
        let existing = base.quality_loop.unwrap_or(QualityLoopConfig {
            enabled: false,
            max_iterations: 3,
            budget_behavior: QualityLoopBudgetBehavior::StopBeforePartialIteration,
            phase_models: None,
        });
        base.quality_loop = Some(QualityLoopConfig {
            enabled: true,
            max_iterations: overrides
                .quality_loop_max_iterations
                .unwrap_or(existing.max_iterations),
            budget_behavior: existing.budget_behavior,
            phase_models: existing.phase_models,
        });
    }
    base
}

pub fn prepare_cli_runtime(
    project_root: &Path,
    config_path: Option<&Path>,
    overrides: &CliConfigOverrides,
) -> Result<CliRuntime, String> {
    let project_config = load_project_config(project_root, config_path)
        .map_err(|err| format!("Failed to load project config: {err}"))?;

    let runtime_context = build_runtime_context(BuildRuntimeContextInput {
        project_root,
        project_config: Some(&project_config.config),
        on_init_stage: None,
    })?;

    let (plan_model, exec_model) = if force_queue_models() {
        default_queue_models()
    } else {
        resolve_language_models(Some(&project_config), CancellationController::new())
    };
    if !model_is_actionable(&project_config, &exec_model) {
        return Err(
            "No reachable model host configured. Set runtimeHost to an Ollama host in rlm.config.yaml.".into(),
        );
    }

    let runtime_config = apply_config_overrides(
        runtime_config_from_config(Some(&project_config.config)),
        overrides,
    );

    Ok(CliRuntime {
        project_root: project_root.to_path_buf(),
        project_config,
        runtime_context,
        plan_model,
        exec_model,
        runtime_config,
    })
}

pub fn prepare_ask_execution(
    project_root: &Path,
    config_path: Option<&Path>,
) -> Result<CliAskRuntime, String> {
    prepare_cli_runtime(project_root, config_path, &CliConfigOverrides::default())
}

fn force_queue_models() -> bool {
    std::env::var("RLM_FORCE_QUEUE_MODELS").ok().as_deref() == Some("1")
}

fn model_is_actionable(loaded: &LoadedProjectConfig, exec_model: &Arc<dyn LanguageModel>) -> bool {
    if force_queue_models() || loaded.path.is_none() {
        return true;
    }
    exec_model.as_ref().type_id() != std::any::TypeId::of::<QueueModel>()
}
