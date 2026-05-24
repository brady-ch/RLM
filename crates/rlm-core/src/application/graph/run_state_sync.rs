use std::collections::HashSet;
use std::sync::Arc;

use crate::application::execution::InteractiveExecutionSession;
use crate::domain::recursive_language_model::ExecutionControl;
use crate::domain::run_state_persistence::LoadedResumeState;
use crate::domain::run_state_types::ResumeCursor;
use crate::domain::types::{ExecutionGraph, ExecutionStatus};

use crate::application::graph::executor::GraphExecutorInput;

pub(super) fn execution_status_label(status: ExecutionStatus) -> String {
    serde_json::to_value(status)
        .ok()
        .and_then(|value| value.as_str().map(str::to_string))
        .unwrap_or_else(|| "running".into())
}

pub(super) fn persist_run_state_status(
    input: &GraphExecutorInput,
    node_id: &str,
    status: ExecutionStatus,
) {
    if let Some(run_state) = input.run_state.as_ref() {
        let _ = run_state.persist_node_status(node_id, &execution_status_label(status));
    }
}

pub(super) fn persist_resume_cursor(
    input: &GraphExecutorInput,
    active_node_id: &str,
    completed_node_ids: &[String],
) {
    if let Some(run_state) = input.run_state.as_ref() {
        let _ = run_state.persist_resume_cursor(&ResumeCursor {
            active_node_id: active_node_id.to_string(),
            completed_node_ids: completed_node_ids.to_vec(),
            variant: "playbook".into(),
        });
    }
}

fn apply_resume_to_session(session: &Arc<InteractiveExecutionSession>, resume: &LoadedResumeState) {
    let control: Arc<dyn ExecutionControl> = Arc::new(
        crate::application::execution::SessionExecutionControl::new(Arc::clone(session)),
    );
    for node_id in &resume.completed_node_ids {
        if session
            .snapshot()
            .graph
            .nodes
            .iter()
            .any(|n| n.id == *node_id)
        {
            control.update_node_status(node_id, ExecutionStatus::Completed, None);
        }
    }
}

pub(super) fn prepare_run_state(
    input: &GraphExecutorInput,
    session: &Arc<InteractiveExecutionSession>,
    graph: &ExecutionGraph,
) -> (HashSet<String>, Vec<String>) {
    let mut skip_completed = HashSet::new();
    let mut completed_node_ids = Vec::new();

    let Some(run_state) = input.run_state.as_ref() else {
        return (skip_completed, completed_node_ids);
    };

    let existing = run_state.get_snapshot().ok().flatten();
    if input.resume {
        if let Some(resume) = run_state.load_resume_state().ok().flatten() {
            apply_resume_to_session(session, &resume);
            for node_id in &resume.completed_node_ids {
                skip_completed.insert(node_id.clone());
                completed_node_ids.push(node_id.clone());
            }
        }
    } else if existing.is_none() {
        let root_prompt = graph
            .nodes
            .iter()
            .find(|node| node.parent_id.is_none())
            .and_then(|node| node.prompt.clone())
            .unwrap_or_else(|| "graph run".into());
        let _ = run_state.initialize(&root_prompt, "default");
    }

    (skip_completed, completed_node_ids)
}
