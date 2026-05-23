use std::sync::Arc;

use async_trait::async_trait;

use crate::domain::recursion::preview;
use crate::domain::recursion::{ModelCompletionHost, QualityLoopHost};
use crate::domain::types::{
    ChatMessage, ExecutionEvent, ExecutionGraphNode, ExecutionStatus, ExecutionStatusUpdateDetail,
    QualityLoopManualDecision, QualityLoopMetadata, QualityLoopUsageSummary, RecursiveModelConfig,
    TaskNode, TokenUsageTrace, ToolCallRecord,
};
use crate::ports::{LanguageModel, Tool};

use super::execution_control::ExecutionControl;
use super::RecursiveLanguageModel;

pub(crate) struct QualityLoopHostAdapter<'a> {
    pub(crate) engine: &'a RecursiveLanguageModel,
    pub(crate) execution: Option<Arc<dyn ExecutionControl>>,
    pub(crate) config: RecursiveModelConfig,
}

#[async_trait]
impl QualityLoopHost for QualityLoopHostAdapter<'_> {
    fn model(&self) -> &dyn LanguageModel {
        self.engine.model.as_ref()
    }

    fn get_model_calls(&self) -> u32 {
        self.engine.get_model_calls()
    }

    fn get_max_model_calls(&self) -> u32 {
        self.engine.get_max_model_calls()
    }

    fn consume_model_call(&self) {
        self.engine.state.lock().expect("engine lock").model_calls += 1;
    }

    fn get_tool_calls_used_count(&self) -> u32 {
        self.engine
            .state
            .lock()
            .expect("engine lock")
            .tool_calls_len
    }

    fn get_token_usage(&self) -> TokenUsageTrace {
        self.engine
            .state
            .lock()
            .expect("engine lock")
            .token_usage
            .clone()
    }

    fn get_depth_selected(&self) -> i32 {
        self.engine
            .state
            .lock()
            .expect("engine lock")
            .metadata
            .depth
            .selected
    }

    fn throw_if_cancelled(&self, task: &TaskNode) -> Result<(), String> {
        self.engine.throw_if_cancelled(task, &self.execution)
    }

    fn is_execution_cancelled(&self) -> bool {
        self.execution.as_ref().is_some_and(|e| e.is_cancelled())
    }

    fn push_metadata_error(&self, message: &str) {
        self.engine
            .state
            .lock()
            .expect("engine lock")
            .metadata
            .errors
            .push(message.into());
    }

    fn emit_execution(&self, event: ExecutionEvent) {
        if let Some(ctrl) = &self.execution {
            ctrl.on_event(event);
        }
    }

    fn write_loop_metadata(&self, node_id: &str, metadata: &QualityLoopMetadata) {
        self.engine
            .write_loop_metadata(node_id, metadata, &self.execution);
        self.engine.update_execution_graph(&self.config);
    }

    fn mark_execution_node_running(&self, node_id: &str) {
        self.engine
            .mark_execution_node_running(node_id, &self.execution);
    }

    fn mark_execution_node_completed(&self, node_id: &str) {
        self.engine
            .mark_execution_node_completed(node_id, &self.execution);
    }

    fn mark_execution_node_failed(
        &self,
        node_id: &str,
        status: ExecutionStatus,
        detail: Option<ExecutionStatusUpdateDetail>,
    ) {
        {
            let mut state = self.engine.state.lock().expect("engine lock");
            if let Some(node) = state.execution_nodes.get_mut(node_id) {
                node.status = status;
            }
        }
        if let Some(ctrl) = &self.execution {
            ctrl.update_node_status(node_id, status, detail);
        }
    }

    fn set_metadata_execution_status(&self, status: ExecutionStatus) {
        self.engine.set_execution_status(&self.execution, status);
    }

    fn summarize_quality_loop_usage(
        &self,
        metadata: &QualityLoopMetadata,
        model_calls_total: Option<u32>,
    ) -> QualityLoopUsageSummary {
        self.engine
            .summarize_quality_loop_usage(metadata, model_calls_total)
    }

    fn with_agent_system_prompt(&self, messages: Vec<ChatMessage>) -> Vec<ChatMessage> {
        let prompt = self
            .engine
            .state
            .lock()
            .expect("engine lock")
            .agent_system_prompt
            .clone();
        if prompt.is_empty() {
            messages
        } else {
            let mut out = vec![ChatMessage::text("system", prompt)];
            out.extend(messages);
            out
        }
    }

    fn update_execution_node_model(&self, node_id: &str, effective_model: Option<String>) {
        if let Some(model) = effective_model {
            let mut state = self.engine.state.lock().expect("engine lock");
            if let Some(node) = state.execution_nodes.get_mut(node_id) {
                let _ = model;
                let _ = node;
            }
        }
    }

    fn get_quality_loop_decision(&self, node_id: &str) -> Option<QualityLoopManualDecision> {
        self.execution
            .as_ref()
            .and_then(|ctrl| ctrl.get_quality_loop_decision(node_id))
    }
}

pub(crate) struct EngineHost<'a> {
    pub(crate) engine: &'a RecursiveLanguageModel,
    pub(crate) execution: Option<Arc<dyn ExecutionControl>>,
}

#[async_trait]
impl ModelCompletionHost for EngineHost<'_> {
    fn get_model_calls(&self) -> u32 {
        self.engine.get_model_calls()
    }

    fn get_max_model_calls(&self) -> u32 {
        self.engine.get_max_model_calls()
    }

    fn get_tool_round_limit(&self) -> u32 {
        self.engine
            .state
            .lock()
            .expect("engine lock")
            .tool_round_limit
    }

    fn consume_model_call(&self) {
        self.engine.state.lock().expect("engine lock").model_calls += 1;
    }

    fn throw_if_cancelled(&self, task: &TaskNode) -> Result<(), String> {
        self.engine.throw_if_cancelled(task, &self.execution)
    }

    fn record_limit(&self, task: &TaskNode, message: &str) {
        self.engine.record_limit(task, message);
    }

    fn record(&self, task: &TaskNode, kind: &str, prompt: &str, output: &str) {
        self.engine.record(task, kind, prompt, output);
    }

    fn push_metadata_error(&self, message: &str) {
        self.engine
            .state
            .lock()
            .expect("engine lock")
            .metadata
            .errors
            .push(message.into());
    }

    fn append_tool_call_record(&self, record: ToolCallRecord) {
        let mut state = self.engine.state.lock().expect("engine lock");
        state.tool_calls_len += 1;
        state.metadata.tool_calls.push(record);
    }

    async fn resolve_memory_packet(&self, _task: &TaskNode) -> Option<String> {
        None
    }

    fn mark_execution_node_failed(
        &self,
        node_id: &str,
        _status: &str,
        detail: Option<ExecutionStatusUpdateDetail>,
    ) {
        if let Some(ctrl) = &self.execution {
            ctrl.update_node_status(node_id, ExecutionStatus::Failed, detail);
        }
    }

    fn tools_for_task(&self, _task: &TaskNode) -> Vec<Arc<dyn Tool>> {
        self.engine.tools.values().cloned().collect()
    }

    fn get_tool_by_name(&self, name: &str) -> Option<Arc<dyn Tool>> {
        self.engine.tools.get(name).cloned()
    }

    async fn request_clarification(
        &self,
        task: &TaskNode,
        _prompt_text: &str,
    ) -> Result<String, String> {
        if let Some(ctrl) = &self.execution {
            let node = ExecutionGraphNode {
                id: task.id.clone(),
                parent_id: task.parent_id.clone(),
                kind: "task".into(),
                label: preview(&task.prompt, 80),
                prompt: Some(task.prompt.clone()),
                depth: task.depth,
                status: ExecutionStatus::AwaitingApproval,
                ..Default::default()
            };
            ctrl.register_node(node);
            ctrl.update_node_status(
                &task.id,
                ExecutionStatus::AwaitingApproval,
                Some(ExecutionStatusUpdateDetail {
                    failure_category: None,
                    code: None,
                    message: Some("clarification required".into()),
                }),
            );
        }
        // Without session wiring, auto-approve clarification with empty answer path is not used in tests.
        Ok(String::new())
    }

    fn model(&self) -> &dyn LanguageModel {
        self.engine.model.as_ref()
    }

    fn with_agent_system_prompt(&self, messages: Vec<ChatMessage>) -> Vec<ChatMessage> {
        let prompt = self
            .engine
            .state
            .lock()
            .expect("engine lock")
            .agent_system_prompt
            .clone();
        if prompt.is_empty() {
            messages
        } else {
            let mut out = vec![ChatMessage::text("system", prompt)];
            out.extend(messages);
            out
        }
    }
}
