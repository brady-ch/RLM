use std::path::PathBuf;
use std::sync::Arc;

use rlm_core::domain::types::ExecutionGraphNode;
use rlm_core::domain::types::{ApprovalMode, ExecutionStatus, ExpertRuntimeMode};
use rlm_core::execution::InteractiveExecutionSession;
use rlm_core::graph::{execute_graph, topological_execution_order, GraphExecutorInput};
use rlm_core::ports::QueueModel;
use rlm_core::{start_server, ServerConfig};
use serde_json::json;

#[test]
fn topological_order_detects_cycles() {
    let graph = rlm_core::domain::types::ExecutionGraph {
        nodes: vec![
            ExecutionGraphNode {
                id: "A".into(),
                depth: 0,
                ..Default::default()
            },
            ExecutionGraphNode {
                id: "B".into(),
                parent_id: Some("A".into()),
                depth: 1,
                ..Default::default()
            },
            ExecutionGraphNode {
                id: "C".into(),
                parent_id: Some("B".into()),
                depth: 2,
                ..Default::default()
            },
        ],
        edges: vec![
            rlm_core::domain::types::ExecutionGraphEdge {
                from: "A".into(),
                to: "B".into(),
                source_handle: None,
                target_handle: None,
            },
            rlm_core::domain::types::ExecutionGraphEdge {
                from: "B".into(),
                to: "C".into(),
                source_handle: None,
                target_handle: None,
            },
            rlm_core::domain::types::ExecutionGraphEdge {
                from: "C".into(),
                to: "A".into(),
                source_handle: None,
                target_handle: None,
            },
        ],
        viewport: None,
    };
    assert!(topological_execution_order(&graph).is_err());
}

#[tokio::test]
async fn node_add_route_returns_added_node_id() {
    let session = InteractiveExecutionSession::new(ApprovalMode::Full);
    session.register_node_for_test(ExecutionGraphNode {
        id: "root".into(),
        label: "Root".into(),
        prompt: Some("root".into()),
        status: ExecutionStatus::Ready,
        ..Default::default()
    });

    let server = start_server(ServerConfig {
        port: 0,
        ui_dist_dir: None,
        project_root: PathBuf::from("."),
        memory_session_id: None,
        session: Some(session),
    })
    .await
    .expect("start server");

    let client = reqwest::Client::new();
    let response = client
        .post(format!("{}/api/nodes/add", server.url))
        .json(&json!({ "parentId": "root", "prompt": "child task", "kind": "task" }))
        .send()
        .await
        .expect("post add");
    assert_eq!(response.status(), reqwest::StatusCode::OK);
    let body: serde_json::Value = response.json().await.expect("json");
    assert!(body.get("addedNodeId").is_some());

    server.close().await;
}

#[tokio::test]
async fn graph_layout_requires_positions_object() {
    let server = start_server(ServerConfig {
        port: 0,
        ui_dist_dir: None,
        project_root: PathBuf::from("."),
        memory_session_id: None,
        session: None,
    })
    .await
    .expect("start server");

    let client = reqwest::Client::new();
    let response = client
        .post(format!("{}/api/graph/layout", server.url))
        .json(&json!({ "bad": true }))
        .send()
        .await
        .expect("post layout");
    assert_eq!(response.status(), reqwest::StatusCode::BAD_REQUEST);

    server.close().await;
}

#[tokio::test]
async fn execute_graph_blocks_child_when_parent_fails() {
    let session = InteractiveExecutionSession::new(ApprovalMode::InitialPlanRecursive);
    session.register_node_for_test(ExecutionGraphNode {
        id: "root".into(),
        label: "Root".into(),
        prompt: Some("Root".into()),
        status: ExecutionStatus::Ready,
        expert_agent_id: Some("missing-agent".into()),
        expert_runtime: Some(ExpertRuntimeMode::SinglePass),
        ..Default::default()
    });
    session.register_node_for_test(ExecutionGraphNode {
        id: "child".into(),
        parent_id: Some("root".into()),
        label: "Child".into(),
        prompt: Some("Child".into()),
        depth: 1,
        status: ExecutionStatus::Ready,
        expert_agent_id: Some("default".into()),
        expert_runtime: Some(ExpertRuntimeMode::SinglePass),
        ..Default::default()
    });
    session.begin_confirmed_execution();

    let model = Arc::new(QueueModel::new(["done"]));
    let create_model = {
        let model = Arc::clone(&model);
        Arc::new(move || Arc::clone(&model) as Arc<dyn rlm_core::ports::LanguageModel>)
    };
    execute_graph(
        session.clone(),
        GraphExecutorInput {
            runtime_config: rlm_core::domain::types::RecursiveModelConfig {
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
        },
    )
    .await
    .unwrap();

    let nodes = session.snapshot().graph.nodes;
    assert_eq!(
        nodes.iter().find(|n| n.id == "root").unwrap().status,
        ExecutionStatus::Failed
    );
    assert_eq!(
        nodes.iter().find(|n| n.id == "child").unwrap().status,
        ExecutionStatus::Failed
    );
}
