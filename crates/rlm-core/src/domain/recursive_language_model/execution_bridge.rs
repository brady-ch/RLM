use std::sync::Arc;

use crate::domain::recursion::{
    build_live_execution_metadata, preview, remaining_model_calls,
};
use crate::domain::types::{
    ExecutionEvent, ExecutionGraphEdge, ExecutionGraphNode, ExecutionStatus, NodeApprovalDecision, NodeApprovalStatus, QualityLoopMetadata,
    QualityLoopUsageSummary, RecursiveModelConfig, RecursivePromptResult, TaskNode, TraceEvent,
};
use crate::ports::Trace;

use super::execution_control::ExecutionControl;
use super::RecursiveLanguageModel;

impl RecursiveLanguageModel {
    pub(crate) fn build_result(&self) -> RecursivePromptResult {
        let state = self.state.lock().expect("engine lock");
        RecursivePromptResult {
            answer: String::new(),
            trace: self.trace.events(),
            metadata: state.metadata.clone(),
        }
    }

    pub(crate) fn get_model_calls(&self) -> u32 {
        self.state.lock().expect("engine lock").model_calls
    }

    pub(crate) fn get_max_model_calls(&self) -> u32 {
        self.state.lock().expect("engine lock").max_model_calls
    }

    pub(crate) fn record(&self, task: &TaskNode, kind: &str, prompt: &str, output: &str) {
        let event = TraceEvent {
            id: task.id.clone(),
            parent_id: task.parent_id.clone(),
            depth: task.depth,
            kind: kind.into(),
            prompt: prompt.into(),
            output: output.into(),
        };
        self.trace.record(event);
    }

    pub(crate) fn record_limit(&self, task: &TaskNode, message: &str) {
        self.record(task, "error", &task.prompt, message);
        self.state
            .lock()
            .expect("engine lock")
            .metadata
            .errors
            .push(message.into());
    }

    pub(crate) fn ensure_execution_node(&self, task: &TaskNode, kind: &str, label_source: &str) {
        let node = ExecutionGraphNode {
            id: task.id.clone(),
            parent_id: task.parent_id.clone(),
            kind: kind.into(),
            label: preview(label_source, 80),
            prompt: Some(task.prompt.clone()),
            depth: task.depth,
            status: ExecutionStatus::Planned,
            model_override: task.model_override.clone(),
            ..Default::default()
        };
        let mut state = self.state.lock().expect("engine lock");
        state.execution_nodes.insert(task.id.clone(), node);
    }

    pub(crate) fn add_edge(&self, from: &str, to: &str) {
        let mut state = self.state.lock().expect("engine lock");
        if !state
            .execution_edges
            .iter()
            .any(|e| e.from == from && e.to == to)
        {
            state.execution_edges.push(ExecutionGraphEdge {
                from: from.into(),
                to: to.into(),
                source_handle: None,
                target_handle: None,
            });
        }
    }

    pub(crate) fn update_execution_graph(&self, config: &RecursiveModelConfig) {
        let mut state = self.state.lock().expect("engine lock");
        let (graph, budget) = build_live_execution_metadata(
            &state.execution_nodes,
            &state.execution_edges,
            state.model_calls,
            state.max_model_calls,
            state.tool_calls_len,
            state.tool_round_limit,
            Some(config),
        );
        state.metadata.execution_graph = Some(graph);
        state.metadata.budget = Some(budget);
    }

    pub(crate) async fn wait_for_node_approval(
        &self,
        task: &TaskNode,
        execution: Option<Arc<dyn ExecutionControl>>,
    ) -> Result<NodeApprovalDecision, String> {
        let node = ExecutionGraphNode {
            id: task.id.clone(),
            parent_id: task.parent_id.clone(),
            kind: "task".into(),
            label: preview(&task.prompt, 80),
            prompt: Some(task.prompt.clone()),
            depth: task.depth,
            status: ExecutionStatus::Planned,
            model_override: task.model_override.clone(),
            ..Default::default()
        };
        if let Some(ctrl) = execution {
            Ok(ctrl.wait_for_node_approval(node).await)
        } else {
            Ok(NodeApprovalDecision {
                status: NodeApprovalStatus::Approved,
                prompt: task.prompt.clone(),
                model_override: None,
            })
        }
    }

    pub(crate) fn throw_if_cancelled(
        &self,
        _task: &TaskNode,
        execution: &Option<Arc<dyn ExecutionControl>>,
    ) -> Result<(), String> {
        if execution.as_ref().is_some_and(|e| e.is_cancelled()) {
            Err(execution
                .as_ref()
                .and_then(|e| e.cancel_reason())
                .unwrap_or_else(|| "Run was cancelled.".into()))
        } else {
            Ok(())
        }
    }

    pub(crate) fn emit_execution(
        &self,
        execution: &Option<Arc<dyn ExecutionControl>>,
        status: ExecutionStatus,
        node_id: Option<String>,
        message: &str,
    ) {
        if let Some(ctrl) = execution {
            let mut event = ExecutionEvent::execution(status);
            event.node_id = node_id;
            event.message = Some(message.into());
            event.model_calls_used = Some(self.get_model_calls());
            event.model_calls_remaining = Some(remaining_model_calls(
                self.get_model_calls(),
                self.get_max_model_calls(),
            ));
            ctrl.on_event(event);
        }
    }

    pub(crate) fn set_execution_status(
        &self,
        execution: &Option<Arc<dyn ExecutionControl>>,
        status: ExecutionStatus,
    ) {
        let mut state = self.state.lock().expect("engine lock");
        state.metadata.execution_status = Some(status);
        drop(state);
        self.emit_execution(execution, status, None, "execution status updated");
    }

    pub(crate) fn sync_execution_status_with_outcome(&self, execution: &Option<Arc<dyn ExecutionControl>>) {
        let status = {
            let state = self.state.lock().expect("engine lock");
            let failed = state
                .execution_nodes
                .values()
                .any(|n| n.status == ExecutionStatus::Failed);
            if failed {
                ExecutionStatus::Failed
            } else {
                ExecutionStatus::Completed
            }
        };
        self.set_execution_status(execution, status);
    }

    pub(crate) fn mark_execution_node_running(
        &self,
        node_id: &str,
        execution: &Option<Arc<dyn ExecutionControl>>,
    ) {
        self.update_node(node_id, ExecutionStatus::Running, execution);
    }

    pub(crate) fn mark_execution_node_completed(
        &self,
        node_id: &str,
        execution: &Option<Arc<dyn ExecutionControl>>,
    ) {
        self.update_node(node_id, ExecutionStatus::Completed, execution);
    }

    pub(crate) fn update_node(
        &self,
        node_id: &str,
        status: ExecutionStatus,
        execution: &Option<Arc<dyn ExecutionControl>>,
    ) {
        {
            let mut state = self.state.lock().expect("engine lock");
            if let Some(node) = state.execution_nodes.get_mut(node_id) {
                node.status = status;
            }
        }
        if let Some(ctrl) = execution {
            ctrl.update_node_status(node_id, status, None);
        }
    }

    pub(crate) fn write_loop_metadata(
        &self,
        node_id: &str,
        metadata: &QualityLoopMetadata,
        execution: &Option<Arc<dyn ExecutionControl>>,
    ) {
        let node_snapshot = {
            let mut state = self.state.lock().expect("engine lock");
            state.metadata.quality_loop = Some(metadata.clone());
            if let Some(node) = state.execution_nodes.get_mut(node_id) {
                node.r#loop = Some(metadata.clone());
                Some(node.clone())
            } else {
                None
            }
        };
        if let (Some(node), Some(ctrl)) = (node_snapshot, execution) {
            ctrl.register_node(node);
        }
    }

    pub(crate) fn summarize_quality_loop_usage(
        &self,
        metadata: &QualityLoopMetadata,
        model_calls_total: Option<u32>,
    ) -> QualityLoopUsageSummary {
        let state = self.state.lock().expect("engine lock");
        let mut usage = metadata.usage.clone();
        usage.model_calls_total = model_calls_total.unwrap_or_else(|| {
            usage.phase_call_counts.draft
                + usage.phase_call_counts.critique
                + usage.phase_call_counts.refine
                + usage.phase_call_counts.gate
                + usage.phase_call_counts.best_of_progress
        });
        usage.input_tokens = state.token_usage.input_tokens;
        usage.output_tokens = state.token_usage.output_tokens;
        usage.total_tokens = state.token_usage.total_tokens;
        usage.unknown_completions = state.token_usage.unknown_completions;
        usage
    }
}
