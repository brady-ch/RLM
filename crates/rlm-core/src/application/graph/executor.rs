use std::collections::{HashMap, HashSet};
use std::sync::Arc;

use crate::application::execution::agent_registry::{filter_agent_tools, resolve_agent};
use crate::application::execution::{InteractiveExecutionSession, SessionExecutionControl};
use crate::domain::recursive_language_model::ExecutionControl;
use crate::domain::run_state_persistence::RunStatePersistence;
use crate::domain::types::{
    ExecutionGraphNode, ExecutionStatus, ExecutionStatusUpdateDetail, ExpertRuntimeMode,
    RecursiveModelConfig,
};
use crate::domain::RecursiveLanguageModel;
use crate::plugins::resolve_tools_for_agent;
use crate::ports::{LanguageModel, LanguageModelCompleteOptions};

use super::execution_order::topological_execution_order;
use super::run_state_sync::{persist_resume_cursor, persist_run_state_status, prepare_run_state};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum GraphExecutorErrorCode {
    InvalidAgent,
    InvalidRuntime,
    BlockedByFailure,
    EmptyGraph,
    CycleDetected,
}

#[derive(Debug)]
pub struct GraphExecutorError {
    pub code: GraphExecutorErrorCode,
    pub message: String,
}

impl std::fmt::Display for GraphExecutorError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.message)
    }
}

impl std::error::Error for GraphExecutorError {}

pub struct GraphExecutorInput {
    pub runtime_config: RecursiveModelConfig,
    pub project_config: Option<serde_json::Value>,
    pub create_model: Arc<dyn Fn() -> Arc<dyn LanguageModel> + Send + Sync>,
    pub runtime: Option<crate::plugins::RuntimeContext>,
    pub run_state: Option<Arc<RunStatePersistence>>,
    pub memory: Option<Arc<dyn crate::ports::MemoryContextPort>>,
    /// When true, load persisted resumeCursor + nodeStatuses and skip completed nodes.
    pub resume: bool,
}

pub fn build_execution_prompt(
    node: &ExecutionGraphNode,
    ancestors: &[ExecutionGraphNode],
) -> String {
    let mut lines = Vec::new();
    if !ancestors.is_empty() {
        lines.push("Context from ancestor steps:".into());
        for (index, ancestor) in ancestors.iter().enumerate() {
            let text = ancestor
                .prompt
                .as_deref()
                .unwrap_or(ancestor.label.as_str());
            lines.push(format!("{}. {}: {}", index + 1, ancestor.label, text));
        }
        lines.push(String::new());
    }
    lines.push("Current task:".into());
    lines.push(node.prompt.clone().unwrap_or_else(|| node.label.clone()));
    lines.join("\n")
}

fn collect_ancestors(
    node: &ExecutionGraphNode,
    node_by_id: &HashMap<String, ExecutionGraphNode>,
) -> Vec<ExecutionGraphNode> {
    let mut ancestors = Vec::new();
    let mut current = node.parent_id.as_ref().and_then(|id| node_by_id.get(id));
    while let Some(n) = current {
        ancestors.insert(0, n.clone());
        current = n.parent_id.as_ref().and_then(|id| node_by_id.get(id));
    }
    ancestors
}

fn has_failed_ancestor(
    node: &ExecutionGraphNode,
    failed: &HashSet<String>,
    node_by_id: &HashMap<String, ExecutionGraphNode>,
) -> bool {
    let mut current = node.parent_id.as_ref().and_then(|id| node_by_id.get(id));
    while let Some(n) = current {
        if failed.contains(&n.id) {
            return true;
        }
        current = n.parent_id.as_ref().and_then(|id| node_by_id.get(id));
    }
    false
}

fn should_skip_status(status: ExecutionStatus) -> bool {
    matches!(
        status,
        ExecutionStatus::Skipped | ExecutionStatus::Cancelled | ExecutionStatus::Completed
    )
}

pub async fn execute_graph(
    session: Arc<InteractiveExecutionSession>,
    input: GraphExecutorInput,
) -> Result<(), GraphExecutorError> {
    let graph = session.snapshot().graph;
    if graph.nodes.is_empty() {
        return Err(GraphExecutorError {
            code: GraphExecutorErrorCode::EmptyGraph,
            message: "Graph has no nodes.".into(),
        });
    }

    let order = topological_execution_order(&graph)?;
    let node_by_id: HashMap<_, _> = graph
        .nodes
        .iter()
        .map(|n| (n.id.clone(), n.clone()))
        .collect();
    let mut failed = HashSet::new();
    let (skip_completed, mut completed_node_ids) = prepare_run_state(&input, &session, &graph);
    let control: Arc<dyn ExecutionControl> =
        Arc::new(SessionExecutionControl::new(Arc::clone(&session)));

    for node_id in order {
        let Some(node) = node_by_id.get(&node_id) else {
            continue;
        };

        if has_failed_ancestor(node, &failed, &node_by_id) {
            control.update_node_status(
                &node_id,
                ExecutionStatus::Failed,
                Some(ExecutionStatusUpdateDetail {
                    code: Some("blocked_by_failure".into()),
                    message: Some("Blocked: ancestor node failed".into()),
                    failure_category: None,
                }),
            );
            persist_run_state_status(&input, &node_id, ExecutionStatus::Failed);
            failed.insert(node_id);
            continue;
        }

        if control.is_cancelled() {
            break;
        }

        if skip_completed.contains(&node_id) {
            continue;
        }

        if should_skip_status(node.status) {
            continue;
        }

        let agent_id = node.expert_agent_id.as_deref().unwrap_or("default");
        let bound_agent = match resolve_agent(agent_id, input.project_config.as_ref()) {
            Ok(agent) => agent,
            Err(message) => {
                control.update_node_status(
                    &node_id,
                    ExecutionStatus::Failed,
                    Some(ExecutionStatusUpdateDetail {
                        code: Some("invalid_agent".into()),
                        message: Some(message),
                        failure_category: None,
                    }),
                );
                persist_run_state_status(&input, &node_id, ExecutionStatus::Failed);
                failed.insert(node_id);
                continue;
            }
        };

        let runtime = match node.expert_runtime {
            Some(r) => r,
            None => {
                control.update_node_status(
                    &node_id,
                    ExecutionStatus::Failed,
                    Some(ExecutionStatusUpdateDetail {
                        code: Some("invalid_runtime".into()),
                        message: Some("Runtime mode must be single-pass or rlm.".into()),
                        failure_category: None,
                    }),
                );
                persist_run_state_status(&input, &node_id, ExecutionStatus::Failed);
                failed.insert(node_id);
                continue;
            }
        };

        if session.is_confirmed_execution_running()
            && node.depth == 0
            && !node.spawned_after_initial_approval.unwrap_or(false)
        {
            control.update_node_status(
                &node_id,
                ExecutionStatus::Approved,
                Some(ExecutionStatusUpdateDetail {
                    message: Some("graph confirmed for run".into()),
                    code: None,
                    failure_category: None,
                }),
            );
        } else {
            let decision = control.wait_for_node_approval(node.clone()).await;
            use crate::domain::types::NodeApprovalStatus;
            match decision.status {
                NodeApprovalStatus::Skipped | NodeApprovalStatus::Cancelled => {
                    let status = match decision.status {
                        NodeApprovalStatus::Skipped => ExecutionStatus::Skipped,
                        NodeApprovalStatus::Cancelled => ExecutionStatus::Cancelled,
                        _ => ExecutionStatus::Skipped,
                    };
                    control.update_node_status(&node_id, status, None);
                    persist_run_state_status(&input, &node_id, status);
                    continue;
                }
                NodeApprovalStatus::Approved => {}
            }
        }

        control.update_node_status(
            &node_id,
            ExecutionStatus::Running,
            Some(ExecutionStatusUpdateDetail {
                message: Some(format!(
                    "Running as {agent_id} ({})",
                    match runtime {
                        ExpertRuntimeMode::SinglePass => "single-pass",
                        ExpertRuntimeMode::Rlm => "rlm",
                    }
                )),
                code: None,
                failure_category: None,
            }),
        );
        persist_run_state_status(&input, &node_id, ExecutionStatus::Running);
        persist_resume_cursor(&input, &node_id, &completed_node_ids);

        let ancestors = collect_ancestors(node, &node_by_id);
        let prompt = build_execution_prompt(node, &ancestors);
        let filtered = filter_agent_tools(&bound_agent, node.expert_tool_allowlist.as_deref());

        let result = match runtime {
            ExpertRuntimeMode::SinglePass => {
                let model = (input.create_model)();
                let response = model
                    .complete(
                        &[
                            crate::domain::types::ChatMessage {
                                role: "system".into(),
                                content: filtered.system_prompt.clone(),
                                ..Default::default()
                            },
                            crate::domain::types::ChatMessage {
                                role: "user".into(),
                                content: prompt,
                                ..Default::default()
                            },
                        ],
                        LanguageModelCompleteOptions::simple(Some("answer"), false),
                    )
                    .await;
                if response.content.starts_with("Ollama inference failed:") {
                    Err(response.content)
                } else {
                    Ok(())
                }
            }
            ExpertRuntimeMode::Rlm => {
                let model = (input.create_model)();
                let trace = Arc::new(crate::ports::InMemoryTrace::new());
                let tools = input
                    .runtime
                    .as_ref()
                    .map(|runtime| {
                        resolve_tools_for_agent(
                            runtime,
                            &filtered,
                            node.expert_tool_allowlist.as_deref(),
                        )
                    })
                    .unwrap_or_default();
                let mut engine = RecursiveLanguageModel::new(model, trace, tools);
                if let Some(memory) = &input.memory {
                    engine = engine.with_memory(Arc::clone(memory));
                }
                engine
                    .run(
                        &prompt,
                        input.runtime_config.clone(),
                        Some(Arc::clone(&control)),
                    )
                    .await
                    .map(|_| ())
            }
        };

        match result {
            Ok(()) => {
                control.update_node_status(&node_id, ExecutionStatus::Completed, None);
                persist_run_state_status(&input, &node_id, ExecutionStatus::Completed);
                completed_node_ids.push(node_id.clone());
                persist_resume_cursor(&input, &node_id, &completed_node_ids);
            }
            Err(message) => {
                control.update_node_status(
                    &node_id,
                    ExecutionStatus::Failed,
                    Some(ExecutionStatusUpdateDetail {
                        message: Some(message),
                        failure_category: Some("model".into()),
                        code: None,
                    }),
                );
                persist_run_state_status(&input, &node_id, ExecutionStatus::Failed);
                failed.insert(node_id);
            }
        }
    }

    session.finish_confirmed_execution();
    Ok(())
}

#[cfg(test)]
#[path = "../../../tests/application/graph/executor.rs"]
mod executor_tests;

#[cfg(test)]
#[path = "../../../tests/application/graph/executor_resume.rs"]
mod executor_resume_tests;
