use super::*;
use crate::domain::types::{ExecutionGraph, ExecutionGraphEdge, ExecutionGraphNode};

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
