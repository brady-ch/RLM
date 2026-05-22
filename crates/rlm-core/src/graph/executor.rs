use std::collections::{HashMap, HashSet};
use std::sync::Arc;

use crate::domain::recursive_language_model::ExecutionControl;
use crate::domain::run_state_persistence::{LoadedResumeState, RunStatePersistence};
use crate::domain::run_state_types::ResumeCursor;
use crate::domain::types::{
    ExecutionGraph, ExecutionGraphNode, ExecutionStatus, ExecutionStatusUpdateDetail,
    ExpertRuntimeMode, RecursiveModelConfig,
};
use crate::domain::RecursiveLanguageModel;
use crate::execution::agent_registry::{filter_agent_tools, resolve_agent};
use crate::execution::{InteractiveExecutionSession, SessionExecutionControl};
use crate::plugins::resolve_tools_for_agent;
use crate::ports::{LanguageModel, LanguageModelCompleteOptions};

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
    /// When true, load persisted resumeCursor + nodeStatuses and skip completed nodes.
    pub resume: bool,
}

fn execution_status_label(status: ExecutionStatus) -> String {
    serde_json::to_value(status)
        .ok()
        .and_then(|value| value.as_str().map(str::to_string))
        .unwrap_or_else(|| "running".into())
}

fn persist_run_state_status(input: &GraphExecutorInput, node_id: &str, status: ExecutionStatus) {
    if let Some(run_state) = input.run_state.as_ref() {
        let _ = run_state.persist_node_status(node_id, &execution_status_label(status));
    }
}

fn persist_resume_cursor(
    input: &GraphExecutorInput,
    active_node_id: &str,
    completed_node_ids: &[String],
) {
    if let Some(run_state) = input.run_state.as_ref() {
        let _ = run_state.persist_resume_cursor(&ResumeCursor {
            active_node_id: active_node_id.to_string(),
            completed_node_ids: completed_node_ids.to_vec(),
            variant: "playbook".into(),
        });
    }
}

pub fn topological_execution_order(
    graph: &ExecutionGraph,
) -> Result<Vec<String>, GraphExecutorError> {
    let node_ids: Vec<_> = graph.nodes.iter().map(|n| n.id.clone()).collect();
    if node_ids.is_empty() {
        return Err(GraphExecutorError {
            code: GraphExecutorErrorCode::EmptyGraph,
            message: "Graph has no nodes.".into(),
        });
    }

    let node_by_id: HashMap<_, _> = graph.nodes.iter().map(|n| (n.id.clone(), n)).collect();
    let mut in_degree: HashMap<String, i32> = HashMap::new();
    let mut adjacency: HashMap<String, Vec<String>> = HashMap::new();

    for id in &node_ids {
        in_degree.insert(id.clone(), 0);
        adjacency.insert(id.clone(), Vec::new());
    }

    for edge in &graph.edges {
        if !node_by_id.contains_key(&edge.from) || !node_by_id.contains_key(&edge.to) {
            continue;
        }
        adjacency.get_mut(&edge.from).unwrap().push(edge.to.clone());
        *in_degree.entry(edge.to.clone()).or_insert(0) += 1;
    }

    for node in &graph.nodes {
        if let Some(parent_id) = &node.parent_id {
            if !node_by_id.contains_key(parent_id) {
                continue;
            }
            let siblings = adjacency.get_mut(parent_id).unwrap();
            if !siblings.contains(&node.id) {
                siblings.push(node.id.clone());
                *in_degree.entry(node.id.clone()).or_insert(0) += 1;
            }
        }
    }

    let mut queue: Vec<_> = node_ids
        .iter()
        .filter(|id| *in_degree.get(*id).unwrap_or(&0) == 0)
        .cloned()
        .collect();
    queue.sort();

    let mut order = Vec::new();
    while let Some(current) = queue.first().cloned() {
        queue.remove(0);
        order.push(current.clone());
        let mut neighbors = adjacency.get(&current).cloned().unwrap_or_default();
        neighbors.sort();
        for next in neighbors {
            let deg = in_degree.get_mut(&next).unwrap();
            *deg -= 1;
            if *deg == 0 {
                queue.push(next);
                queue.sort();
            }
        }
    }

    if order.len() != node_ids.len() {
        return Err(GraphExecutorError {
            code: GraphExecutorErrorCode::CycleDetected,
            message: "Cycle detected in execution graph.".into(),
        });
    }
    Ok(order)
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

fn apply_resume_to_session(session: &Arc<InteractiveExecutionSession>, resume: &LoadedResumeState) {
    let control: Arc<dyn ExecutionControl> =
        Arc::new(SessionExecutionControl::new(Arc::clone(session)));
    for node_id in &resume.completed_node_ids {
        if session
            .snapshot()
            .graph
            .nodes
            .iter()
            .any(|n| n.id == *node_id)
        {
            control.update_node_status(node_id, ExecutionStatus::Completed, None);
        }
    }
}

fn prepare_run_state(
    input: &GraphExecutorInput,
    session: &Arc<InteractiveExecutionSession>,
    graph: &ExecutionGraph,
) -> (HashSet<String>, Vec<String>) {
    let mut skip_completed = HashSet::new();
    let mut completed_node_ids = Vec::new();

    let Some(run_state) = input.run_state.as_ref() else {
        return (skip_completed, completed_node_ids);
    };

    let existing = run_state.get_snapshot().ok().flatten();
    if input.resume {
        if let Some(resume) = run_state.load_resume_state().ok().flatten() {
            apply_resume_to_session(session, &resume);
            for node_id in &resume.completed_node_ids {
                skip_completed.insert(node_id.clone());
                completed_node_ids.push(node_id.clone());
            }
        }
    } else if existing.is_none() {
        let root_prompt = graph
            .nodes
            .iter()
            .find(|node| node.parent_id.is_none())
            .and_then(|node| node.prompt.clone())
            .unwrap_or_else(|| "graph run".into());
        let _ = run_state.initialize(&root_prompt, "default");
    }

    (skip_completed, completed_node_ids)
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
                            },
                            crate::domain::types::ChatMessage {
                                role: "user".into(),
                                content: prompt,
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
                let engine = RecursiveLanguageModel::new(model, trace, tools);
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
mod tests {
    use super::*;
    use crate::domain::types::{ExecutionGraphEdge, ExpertRuntimeMode};
    use crate::execution::InteractiveExecutionSession;

    fn make_node(id: &str, mut partial: ExecutionGraphNode) -> ExecutionGraphNode {
        partial.id = id.into();
        partial
    }

    #[test]
    fn topological_order_parent_before_child() {
        let graph = ExecutionGraph {
            nodes: vec![
                make_node(
                    "root",
                    ExecutionGraphNode {
                        depth: 0,
                        ..Default::default()
                    },
                ),
                make_node(
                    "A",
                    ExecutionGraphNode {
                        parent_id: Some("root".into()),
                        depth: 1,
                        ..Default::default()
                    },
                ),
            ],
            edges: vec![ExecutionGraphEdge {
                from: "root".into(),
                to: "A".into(),
                source_handle: None,
                target_handle: None,
            }],
            viewport: None,
        };
        assert_eq!(
            topological_execution_order(&graph).unwrap(),
            vec!["root", "A"]
        );
    }

    #[tokio::test]
    async fn execute_graph_completes_single_pass_nodes() {
        use crate::domain::types::ApprovalMode;
        use crate::ports::QueueModel;

        let session = InteractiveExecutionSession::new(ApprovalMode::InitialPlanRecursive);
        session.register_node_for_test(ExecutionGraphNode {
            id: "root".into(),
            label: "Root".into(),
            prompt: Some("Root task".into()),
            status: ExecutionStatus::Ready,
            expert_agent_id: Some("default".into()),
            expert_runtime: Some(ExpertRuntimeMode::SinglePass),
            ..Default::default()
        });
        session.begin_confirmed_execution();

        let model = Arc::new(QueueModel::new(["done"]));
        let create_model = {
            let model = Arc::clone(&model);
            Arc::new(move || Arc::clone(&model) as Arc<dyn LanguageModel>)
        };
        execute_graph(
            session.clone(),
            GraphExecutorInput {
                runtime_config: RecursiveModelConfig {
                    max_depth: Some(0),
                    max_dynamic_depth: 0,
                    max_branches: 4,
                    max_prompt_characters: 4096,
                    max_model_calls: 50,
                    max_tool_rounds: 0,
                    quality_loop: None,
                },
                project_config: None,
                create_model,
                runtime: None,
                run_state: None,
                resume: false,
            },
        )
        .await
        .unwrap();

        let node = session
            .snapshot()
            .graph
            .nodes
            .into_iter()
            .find(|n| n.id == "root")
            .unwrap();
        assert_eq!(node.status, ExecutionStatus::Completed);
    }
}
