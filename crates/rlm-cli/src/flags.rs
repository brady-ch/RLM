use std::path::PathBuf;

use clap::Args;
use rlm_core::domain::types::{ApprovalMode, ReplanChoice};

#[derive(Args, Debug, Clone, Default)]
pub struct ExecutionFlags {
    /// Override YAML runtime recursion depth
    #[arg(long)]
    pub depth: Option<i32>,

    /// Override YAML runtime maximum model-selected recursion depth
    #[arg(long)]
    pub max_depth: Option<i32>,

    /// Override YAML runtime maximum subtasks per recursive step
    #[arg(long)]
    pub branches: Option<i32>,

    /// Override YAML runtime task prompt truncation
    #[arg(long)]
    pub max_prompt_chars: Option<usize>,

    /// Override YAML runtime total model-call budget
    #[arg(long)]
    pub max_model_calls: Option<u32>,

    /// Override YAML runtime maximum tool-call rounds per model step
    #[arg(long)]
    pub max_tool_rounds: Option<u32>,

    /// Enable bounded answer quality loop mode
    #[arg(long)]
    pub quality_loop: bool,

    /// Enable quality loop mode with a positive max iteration bound
    #[arg(long)]
    pub quality_loop_max_iterations: Option<u32>,

    /// Override YAML default Ollama model
    #[arg(long)]
    pub model: Option<String>,

    /// Agent override (default, coding, product_designer, research)
    #[arg(long)]
    pub agent: Option<String>,

    /// Run configured or disk-resolved graph workflow sidecar
    #[arg(long)]
    pub workflow: Option<String>,

    /// Graph workflow variant override: playbook | pipeline
    #[arg(long)]
    pub variant: Option<String>,

    /// Ollama base URL
    #[arg(long)]
    pub base_url: Option<String>,

    /// Runtime host id
    #[arg(long)]
    pub host: Option<String>,

    /// Print compact output for compatibility
    #[arg(long)]
    pub compact: bool,

    /// Print recursion trace
    #[arg(long)]
    pub trace: bool,

    /// Log workflow progress to stderr
    #[arg(long)]
    pub verbose: bool,

    /// Emit JSON execution events while running
    #[arg(long)]
    pub json_stream: bool,

    /// Build and print execution plan, but do not execute
    #[arg(long)]
    pub plan_only: bool,

    /// Print plan first, then wait for explicit approval before executing
    #[arg(long)]
    pub require_approval: bool,

    /// Approval behavior: full | initial-plan | initial-plan-recursive
    #[arg(long, value_parser = parse_approval_mode)]
    pub approval_mode: Option<String>,

    /// Auto-approve a require-approval run (non-interactive)
    #[arg(long)]
    pub approve: bool,

    /// Saved session id for workflow-export
    #[arg(long)]
    pub export_session: Option<String>,

    /// Workflow id alias for workflow-import (same as --workflow)
    #[arg(long)]
    pub import_workflow: Option<String>,

    /// Optional description for workflow-export
    #[arg(long)]
    pub description: Option<String>,

    /// List saved UI sessions and exit
    #[arg(long)]
    pub session_list: bool,

    /// Inspect saved session restore verification and exit
    #[arg(long)]
    pub session_inspect: Option<String>,

    /// Open a saved session in UI mode
    #[arg(long)]
    pub open_session: Option<String>,

    /// Inspect memory scopes, episodes, packets, and audit for a run id
    #[arg(long)]
    pub memory_inspect: Option<String>,

    /// Set a project memory preference and exit (key=value)
    #[arg(long)]
    pub preference_set: Option<String>,

    /// Delete a project memory preference and exit
    #[arg(long)]
    pub preference_delete: Option<String>,

    /// Node id for plan-node
    #[arg(long)]
    pub node_id: Option<String>,

    /// plan-node replan choice: replace | merge | cancel
    #[arg(long, value_parser = parse_replan)]
    pub replan: Option<ReplanChoice>,

    /// Prompt for plan-node / ask when not passed positionally
    #[arg(long = "prompt", id = "prompt_flag")]
    pub prompt_flag: Option<String>,
}

impl ExecutionFlags {
    pub fn resolved_approval_mode(&self) -> ApprovalMode {
        if let Some(mode) = self.approval_mode.as_deref() {
            return parse_approval_mode(mode).unwrap_or(ApprovalMode::Full);
        }
        if self.require_approval {
            return ApprovalMode::Full;
        }
        ApprovalMode::Full
    }

    pub fn resolved_workflow_id(&self) -> Option<&str> {
        self.import_workflow.as_deref().or(self.workflow.as_deref())
    }
}

fn parse_approval_mode(value: &str) -> Result<ApprovalMode, String> {
    match value {
        "full" => Ok(ApprovalMode::Full),
        "initial-plan" => Ok(ApprovalMode::InitialPlan),
        "initial-plan-recursive" => Ok(ApprovalMode::InitialPlanRecursive),
        _ => Err(format!(
            "approval mode must be one of: full, initial-plan, initial-plan-recursive (got {value})"
        )),
    }
}

fn parse_replan(value: &str) -> Result<ReplanChoice, String> {
    match value {
        "replace" => Ok(ReplanChoice::Replace),
        "merge" => Ok(ReplanChoice::Merge),
        "cancel" => Ok(ReplanChoice::Cancel),
        _ => Err(format!(
            "replan must be one of: replace, merge, cancel (got {value})"
        )),
    }
}

pub fn parse_preference_assignment(value: &str) -> Result<(String, String), String> {
    let separator = value
        .find('=')
        .ok_or("--preference-set must use key=value.")?;
    if separator == 0 {
        return Err("--preference-set must use key=value.".into());
    }
    let key = value[..separator].trim().to_string();
    let pref_value = value[separator + 1..].trim().to_string();
    if key.is_empty() || pref_value.is_empty() {
        return Err("--preference-set requires non-empty key and value.".into());
    }
    Ok((key, pref_value))
}

pub struct CommandContext {
    pub project_root: PathBuf,
    pub config_path: Option<PathBuf>,
    pub json: bool,
    pub flags: ExecutionFlags,
}
