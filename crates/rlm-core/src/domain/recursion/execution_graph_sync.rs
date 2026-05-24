use std::collections::HashMap;

use crate::domain::recursion::{estimate_model_calls, estimate_tool_rounds, remaining_model_calls};
use crate::domain::types::{
    ExecutionBudget, ExecutionGraph, ExecutionGraphEdge, ExecutionGraphNode, RecursiveModelConfig,
};

pub fn build_live_execution_metadata(
    execution_nodes: &HashMap<String, ExecutionGraphNode>,
    execution_edges: &[ExecutionGraphEdge],
    model_calls: u32,
    max_model_calls: u32,
    tool_calls_length: u32,
    tool_round_limit: u32,
    config: Option<&RecursiveModelConfig>,
) -> (ExecutionGraph, ExecutionBudget) {
    let graph = ExecutionGraph {
        nodes: execution_nodes.values().cloned().collect(),
        edges: execution_edges.to_vec(),
        viewport: None,
    };
    let budget = ExecutionBudget {
        estimated_model_calls: estimate_model_calls(config, model_calls),
        estimated_tool_rounds: estimate_tool_rounds(tool_round_limit, config),
        model_calls_used: model_calls,
        model_calls_remaining: remaining_model_calls(model_calls, max_model_calls),
        tool_calls_used: tool_calls_length,
    };
    (graph, budget)
}

#[cfg(test)]
#[path = "../../../tests/domain/recursion/execution_graph_sync.rs"]
mod execution_graph_sync_tests;
