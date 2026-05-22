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
mod tests {
    use super::*;
    use crate::domain::types::ExecutionStatus;

    #[test]
    fn mirrors_nodes_and_budget() {
        let mut nodes = HashMap::new();
        nodes.insert(
            "n1".into(),
            ExecutionGraphNode {
                id: "n1".into(),
                parent_id: None,
                kind: "task".into(),
                label: "task".into(),
                prompt: Some("p".into()),
                depth: 0,
                status: ExecutionStatus::Running,
                ..Default::default()
            },
        );
        let config = RecursiveModelConfig {
            max_depth: Some(0),
            max_dynamic_depth: 0,
            max_branches: 4,
            max_prompt_characters: 4096,
            max_model_calls: 50,
            max_tool_rounds: 0,
            quality_loop: None,
        };
        let (graph, budget) =
            build_live_execution_metadata(&nodes, &[], 2, 50, 0, 0, Some(&config));
        assert_eq!(graph.nodes.len(), 1);
        assert_eq!(budget.model_calls_used, 2);
        assert_eq!(budget.model_calls_remaining, 48);
    }
}
