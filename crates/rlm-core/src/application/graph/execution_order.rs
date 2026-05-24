use std::collections::HashMap;

use crate::domain::types::ExecutionGraph;

use crate::application::graph::executor::{GraphExecutorError, GraphExecutorErrorCode};

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

#[cfg(test)]
#[path = "../../../tests/application/graph/execution_order.rs"]
mod execution_order_tests;
