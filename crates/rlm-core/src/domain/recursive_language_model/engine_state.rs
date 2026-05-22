use std::collections::HashMap;

use crate::domain::types::{
    DepthMetadata, ExecutionGraphEdge, ExecutionGraphNode, RecursivePromptMetadata,
    TokenUsageTrace,
};
use crate::domain::types::ChatMessage;

pub(crate) struct EngineState {
    pub next_id: u32,
    pub model_calls: u32,
    pub max_model_calls: u32,
    pub tool_round_limit: u32,
    pub agent_system_prompt: String,
    pub metadata: RecursivePromptMetadata,
    pub execution_nodes: HashMap<String, ExecutionGraphNode>,
    pub execution_edges: Vec<ExecutionGraphEdge>,
    pub tool_calls_len: u32,
    pub token_usage: TokenUsageTrace,
}

impl EngineState {
    pub(crate) fn create_id(&mut self) -> String {
        let id = format!("task-{}", self.next_id);
        self.next_id += 1;
        id
    }
}

pub(crate) fn empty_metadata() -> RecursivePromptMetadata {
    RecursivePromptMetadata {
        depth: DepthMetadata {
            selected: 0,
            source: "unset".into(),
        },
        execution_status: None,
        execution_graph: None,
        budget: None,
        model_calls: 0,
        errors: Vec::new(),
        quality_loop: None,
    }
}

pub(crate) fn fallback_from_messages_slice(messages: &[ChatMessage]) -> String {
    crate::domain::recursion::fallback_from_messages(messages)
}
