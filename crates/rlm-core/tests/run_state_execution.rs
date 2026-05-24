use std::fs;
use std::sync::Arc;

use rlm_core::domain::run_state_persistence::RunStatePersistence;
use rlm_core::domain::types::{
    ApprovalMode, ExecutionGraphNode, ExecutionStatus, ExpertRuntimeMode,
};
use rlm_core::execution::InteractiveExecutionSession;
use rlm_core::graph::{execute_graph, GraphExecutorInput};
use rlm_core::persistence::FileRunStateStore;
use rlm_core::ports::QueueModel;

#[tokio::test]
async fn run_state_snapshot_after_execution_contains_mutation_log() {
    let dir = tempfile::tempdir().expect("tempdir");
    let run_state_dir = dir.path().join(".planning/runs");
    fs::create_dir_all(&run_state_dir).expect("run state dir");

    let session = InteractiveExecutionSession::new(ApprovalMode::InitialPlanRecursive);
    session.register_node_for_test(ExecutionGraphNode {
        id: "root".into(),
        label: "Root".into(),
        prompt: Some("Run state test".into()),
        status: ExecutionStatus::Ready,
        expert_agent_id: Some("default".into()),
        expert_runtime: Some(ExpertRuntimeMode::SinglePass),
        ..Default::default()
    });
    session.begin_confirmed_execution();

    let store: Arc<dyn rlm_core::ports::RunStateStorePort> =
        Arc::new(FileRunStateStore::new(run_state_dir.clone()));
    let run_state = Arc::new(RunStatePersistence::new("run-ui", Arc::clone(&store)));
    let model = Arc::new(QueueModel::new(["done"]));
    let create_model = {
        let model = Arc::clone(&model);
        Arc::new(move || Arc::clone(&model) as Arc<dyn rlm_core::ports::LanguageModel>)
    };

    execute_graph(
        session,
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
            run_state: Some(run_state),
            memory: None,
            resume: false,
        },
    )
    .await
    .expect("execute graph");

    let snapshot = store
        .get_snapshot("run-ui")
        .expect("get snapshot")
        .expect("snapshot exists");
    assert!(!snapshot.mutation_log.is_empty());
    assert!(snapshot
        .node_statuses
        .iter()
        .any(|entry| entry.node_id == "root" && entry.status == "completed"));
}
