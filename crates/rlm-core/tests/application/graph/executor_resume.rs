use std::fs;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Arc;

use async_trait::async_trait;

use super::*;
use crate::application::execution::InteractiveExecutionSession;
use crate::domain::run_state_persistence::RunStatePersistence;
use crate::domain::run_state_types::ResumeCursor;
use crate::domain::types::{
    ApprovalMode, ChatMessage, ExecutionGraphNode, ExecutionStatus, ExpertRuntimeMode,
    LanguageModelResponse, RecursiveModelConfig,
};
use crate::persistence::FileRunStateStore;
use crate::ports::{LanguageModel, LanguageModelCompleteOptions, RunStateStorePort};

struct CountingModel {
    calls: Arc<AtomicUsize>,
}

#[async_trait]
impl LanguageModel for CountingModel {
    async fn complete(
        &self,
        _messages: &[ChatMessage],
        _options: LanguageModelCompleteOptions<'_>,
    ) -> LanguageModelResponse {
        self.calls.fetch_add(1, Ordering::SeqCst);
        LanguageModelResponse {
            content: "done".into(),
            model: Some("mock".into()),
            tool_calls: Vec::new(),
        }
    }
}

fn make_node(id: &str, parent_id: Option<&str>, depth: i32) -> ExecutionGraphNode {
    ExecutionGraphNode {
        id: id.into(),
        label: id.into(),
        prompt: Some(format!("{id} task")),
        parent_id: parent_id.map(str::to_string),
        depth,
        status: ExecutionStatus::Ready,
        expert_agent_id: Some("default".into()),
        expert_runtime: Some(ExpertRuntimeMode::SinglePass),
        ..Default::default()
    }
}

#[tokio::test]
async fn resume_skips_completed_nodes_and_runs_remaining() {
    let dir = tempfile::tempdir().expect("tempdir");
    let run_state_dir = dir.path().join(".planning/runs");
    fs::create_dir_all(&run_state_dir).expect("run state dir");
    let run_id = "run-resume-unit";

    let store: Arc<dyn RunStateStorePort> = Arc::new(FileRunStateStore::new(run_state_dir));
    let run_state = Arc::new(RunStatePersistence::new(run_id, Arc::clone(&store)));

    run_state
        .initialize("root task", "default")
        .expect("initialize");
    run_state
        .persist_node_status("root", "completed")
        .expect("persist root");
    run_state
        .persist_resume_cursor(&ResumeCursor {
            active_node_id: "child".into(),
            completed_node_ids: vec!["root".into()],
            variant: "playbook".into(),
        })
        .expect("persist cursor");

    let session = InteractiveExecutionSession::new(ApprovalMode::InitialPlanRecursive);
    session.register_node_for_test(make_node("root", None, 0));
    session.register_node_for_test(make_node("child", None, 0));
    session.begin_confirmed_execution();

    let calls = Arc::new(AtomicUsize::new(0));
    let counter = Arc::clone(&calls);
    let create_model = Arc::new(move || {
        Arc::new(CountingModel {
            calls: Arc::clone(&counter),
        }) as Arc<dyn LanguageModel>
    });

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
            run_state: Some(Arc::new(RunStatePersistence::new(
                run_id,
                Arc::clone(&store),
            ))),
            memory: None,
            resume: true,
        },
    )
    .await
    .expect("resume execute graph");

    let nodes = session.snapshot().graph.nodes;
    let root = nodes.iter().find(|n| n.id == "root").expect("root");
    let child = nodes.iter().find(|n| n.id == "child").expect("child");
    assert_eq!(root.status, ExecutionStatus::Completed);
    assert_eq!(child.status, ExecutionStatus::Completed);
    assert_eq!(
        calls.load(Ordering::SeqCst),
        1,
        "only the incomplete child node should invoke the model"
    );
}
