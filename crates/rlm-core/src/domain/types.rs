use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ExecutionStatus {
    Planned,
    Ready,
    #[serde(rename = "awaiting_approval")]
    AwaitingApproval,
    Approved,
    Running,
    Completed,
    Skipped,
    Failed,
    Cancelled,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "kebab-case")]
pub enum ApprovalMode {
    #[default]
    Full,
    #[serde(rename = "initial-plan")]
    InitialPlan,
    #[serde(rename = "initial-plan-recursive")]
    InitialPlanRecursive,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExecutionGraphNode {
    pub id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub parent_id: Option<String>,
    pub kind: String,
    pub label: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub prompt: Option<String>,
    pub depth: i32,
    pub status: ExecutionStatus,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub approval_token: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub model_override: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub approval_source: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub approval_reason: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub spawned_after_initial_approval: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub position: Option<GraphPosition>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub original_prompt: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub expert_agent_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub expert_assignment_mode: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub expert_runtime: Option<ExpertRuntimeMode>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub expert_tool_allowlist: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub expert_purpose_tiers: Option<HashMap<String, String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sampling_override: Option<SamplingOverride>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub composer: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub editable_fields: Option<Vec<String>>,
}

impl Default for ExecutionGraphNode {
    fn default() -> Self {
        Self {
            id: String::new(),
            parent_id: None,
            kind: "task".into(),
            label: String::new(),
            prompt: None,
            depth: 0,
            status: ExecutionStatus::Planned,
            approval_token: None,
            model_override: None,
            approval_source: None,
            approval_reason: None,
            spawned_after_initial_approval: None,
            position: None,
            original_prompt: None,
            expert_agent_id: None,
            expert_assignment_mode: None,
            expert_runtime: None,
            expert_tool_allowlist: None,
            expert_purpose_tiers: None,
            sampling_override: None,
            composer: None,
            editable_fields: None,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum ExpertRuntimeMode {
    #[serde(rename = "single-pass")]
    SinglePass,
    Rlm,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum DeleteStrategy {
    RewireDependents,
    DeleteSubtree,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ReplanChoice {
    Replace,
    Merge,
    Cancel,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GraphMutationError {
    pub code: String,
    pub error: String,
    pub node_ids: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub details: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub suggested_fix: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ComposerPlanBudget {
    pub max_depth: i32,
    pub max_nodes: i32,
    pub used_depth: i32,
    pub used_nodes: i32,
    pub remaining_depth: i32,
    pub remaining_nodes: i32,
    pub exhausted: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub approval_required: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlanNodeResult {
    pub planned_node_ids: Vec<String>,
    pub budget: ComposerPlanBudget,
    pub exhausted: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatRunReadiness {
    pub state: String,
    pub reason: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GraphWorkflowMetadata {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub linked_workflow_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_variant: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub exported_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GraphPosition {
    pub x: f64,
    pub y: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutionGraphEdge {
    pub from: String,
    pub to: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source_handle: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub target_handle: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GraphViewport {
    pub x: f64,
    pub y: f64,
    pub zoom: f64,
}

impl Default for GraphViewport {
    fn default() -> Self {
        Self {
            x: 0.0,
            y: 0.0,
            zoom: 1.0,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExecutionGraph {
    pub nodes: Vec<ExecutionGraphNode>,
    pub edges: Vec<ExecutionGraphEdge>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub viewport: Option<GraphViewport>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExecutionEvent {
    #[serde(rename = "type")]
    pub event_type: String,
    pub status: ExecutionStatus,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub node_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub subtype: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub model_calls_used: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub model_calls_remaining: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tool_calls_used: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub approval_mode: Option<ApprovalMode>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub approval_source: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub failure_category: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub code: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub pending_clarification: Option<ClarificationQuestion>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub clarification_record: Option<ClarificationRecord>,
}

impl ExecutionEvent {
    pub fn execution(status: ExecutionStatus) -> Self {
        Self {
            event_type: "execution".into(),
            status,
            node_id: None,
            subtype: None,
            model_calls_used: None,
            model_calls_remaining: None,
            tool_calls_used: None,
            message: None,
            approval_mode: None,
            approval_source: None,
            failure_category: None,
            code: None,
            pending_clarification: None,
            clarification_record: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ClarificationQuestion {
    pub question_id: String,
    pub node_id: String,
    pub prompt_text: String,
    pub asked_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClarificationRecord {
    pub question_id: String,
    pub node_id: String,
    pub prompt_text: String,
    pub user_answer: String,
    pub asked_at: String,
    pub answered_at: String,
    pub resume_event_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
pub enum ChatReadiness {
    LegacyEmpty(String),
    Structured { state: String, reason: String },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionSnapshot {
    pub graph: ExecutionGraph,
    pub status: ExecutionStatus,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub active_node_id: Option<String>,
    pub approval_mode: ApprovalMode,
    pub auto_approval_paused: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub run_summary: Option<RunSummary>,
    pub chat: ChatSnapshot,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RunSummary {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatSnapshot {
    pub readiness: ChatReadiness,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub pending_mutation: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub pending_clarification: Option<ClarificationQuestion>,
    pub clarification_history: Vec<ClarificationRecord>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RunModeSnapshot {
    pub approval_mode: ApprovalMode,
    pub approval_mode_label: String,
    pub auto_approval_paused: bool,
}

pub fn approval_mode_label(mode: ApprovalMode) -> &'static str {
    match mode {
        ApprovalMode::Full => "Full checkpoints",
        ApprovalMode::InitialPlan => "Initial plan",
        ApprovalMode::InitialPlanRecursive => "Initial plan + recursive",
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecursiveModelConfig {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_depth: Option<i32>,
    pub max_dynamic_depth: i32,
    pub max_branches: i32,
    pub max_prompt_characters: usize,
    pub max_model_calls: u32,
    pub max_tool_rounds: u32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub quality_loop: Option<QualityLoopConfig>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QualityLoopConfig {
    pub enabled: bool,
    #[serde(default = "default_max_iterations")]
    pub max_iterations: u32,
}

fn default_max_iterations() -> u32 {
    3
}

#[derive(Debug, Clone)]
pub struct TaskNode {
    pub id: String,
    pub parent_id: Option<String>,
    pub prompt: String,
    pub depth: i32,
    pub kind: Option<String>,
    pub model_override: Option<String>,
}

#[derive(Debug, Clone)]
pub struct SolvedTask {
    pub id: String,
    pub prompt: String,
    pub answer: String,
    pub summary: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExecutionBudget {
    pub estimated_model_calls: u32,
    pub estimated_tool_rounds: u32,
    pub model_calls_used: u32,
    pub model_calls_remaining: u32,
    pub tool_calls_used: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TraceEvent {
    pub id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub parent_id: Option<String>,
    pub depth: i32,
    pub kind: String,
    pub prompt: String,
    pub output: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecursivePromptMetadata {
    pub depth: DepthMetadata,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub execution_status: Option<ExecutionStatus>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub execution_graph: Option<ExecutionGraph>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub budget: Option<ExecutionBudget>,
    pub model_calls: u32,
    pub errors: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DepthMetadata {
    pub selected: i32,
    pub source: String,
}

#[derive(Debug, Clone)]
pub struct RecursivePromptResult {
    pub answer: String,
    pub trace: Vec<TraceEvent>,
    pub metadata: RecursivePromptMetadata,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum NodeApprovalStatus {
    Approved,
    Skipped,
    Cancelled,
}

#[derive(Debug, Clone)]
pub struct NodeApprovalDecision {
    pub status: NodeApprovalStatus,
    pub prompt: String,
    pub model_override: Option<String>,
}

#[derive(Debug, Clone)]
pub struct ExecutionStatusUpdateDetail {
    pub failure_category: Option<String>,
    pub code: Option<String>,
    pub message: Option<String>,
}

#[derive(Debug, Clone)]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
}

#[derive(Debug, Clone)]
pub struct ToolCallRequest {
    pub name: String,
    pub arguments: Value,
}

#[derive(Debug, Clone)]
pub struct LanguageModelResponse {
    pub content: String,
    pub model: Option<String>,
    pub tool_calls: Vec<ToolCallRequest>,
}

#[derive(Debug, Clone)]
pub struct ToolExecutionResult {
    pub content: String,
    pub is_error: bool,
}

pub type SamplingOverride = HashMap<String, Value>;
