use std::collections::HashMap;

use super::*;
use crate::domain::types::{ExecutionGraphNode, ExecutionStatus, RecursiveModelConfig};

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
