use std::sync::Arc;

use super::*;
use crate::application::execution::InteractiveExecutionSession;
use crate::domain::types::{ApprovalMode, ExecutionStatus, ExpertRuntimeMode};
use crate::ports::QueueModel;

#[tokio::test]
async fn execute_graph_completes_single_pass_nodes() {
    let session = InteractiveExecutionSession::new(ApprovalMode::InitialPlanRecursive);
    session.register_node_for_test(crate::domain::types::ExecutionGraphNode {
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
            memory: None,
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
