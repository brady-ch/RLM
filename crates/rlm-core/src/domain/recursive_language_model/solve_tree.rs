use std::sync::Arc;

use crate::domain::recursion::{
    can_spend_any_model_call, has_call_reserved_for_direct_answer, is_code_task,
    remaining_model_calls,
};
use crate::domain::types::{
    ExecutionStatus, NodeApprovalStatus, RecursiveModelConfig, SolvedTask, TaskNode,
};

use super::execution_control::ExecutionControl;
use super::{RecursiveLanguageModel, RECURSIVE};

impl RecursiveLanguageModel {
    pub(crate) async fn solve_inner(
        &self,
        task: &TaskNode,
        config: &RecursiveModelConfig,
        execution: Option<Arc<dyn ExecutionControl>>,
    ) -> Result<String, String> {
        self.throw_if_cancelled(task, &execution)?;

        let decision = self.wait_for_node_approval(task, execution.clone()).await?;
        if decision.status == NodeApprovalStatus::Skipped {
            return Ok(String::new());
        }
        if decision.status == NodeApprovalStatus::Cancelled {
            return Err(execution
                .as_ref()
                .and_then(|e| e.cancel_reason())
                .unwrap_or_else(|| "Run was cancelled.".into()));
        }

        let mut task = task.clone();
        task.prompt = decision.prompt;
        task.model_override = decision.model_override;

        self.mark_execution_node_running(&task.id, &execution);

        if is_code_task(&task) {
            self.emit_execution(
                &execution,
                ExecutionStatus::Running,
                Some(task.id.clone()),
                "executing code-only node",
            );
        }

        let max_depth = config.max_depth.unwrap_or(0);
        if task.depth >= max_depth {
            let answer = self
                .answer_directly(
                    &task,
                    "Depth limit reached; answer directly.",
                    execution.clone(),
                )
                .await?;
            self.mark_execution_node_completed(&task.id, &execution);
            return Ok(answer);
        }

        if remaining_model_calls(self.get_model_calls(), self.get_max_model_calls()) <= 1 {
            let answer = self
                .answer_directly(
                    &task,
                    "Model call budget is nearly exhausted; answer directly.",
                    execution.clone(),
                )
                .await?;
            self.mark_execution_node_completed(&task.id, &execution);
            return Ok(answer);
        }

        let classification = self.classify(&task, execution.clone()).await?;
        if classification != RECURSIVE {
            let answer = self
                .answer_directly(
                    &task,
                    "Task is simple enough for a direct answer.",
                    execution.clone(),
                )
                .await?;
            self.mark_execution_node_completed(&task.id, &execution);
            return Ok(answer);
        }

        if !has_call_reserved_for_direct_answer(self.get_model_calls(), config.max_model_calls) {
            let answer = self
                .answer_directly(
                    &task,
                    "Model call budget is nearly exhausted; answer directly.",
                    execution.clone(),
                )
                .await?;
            self.mark_execution_node_completed(&task.id, &execution);
            return Ok(answer);
        }

        let children = self.decompose(&task, config, execution.clone()).await?;
        if children.is_empty() {
            let answer = self
                .answer_directly(
                    &task,
                    "No useful subtasks were found; answer directly.",
                    execution.clone(),
                )
                .await?;
            self.mark_execution_node_completed(&task.id, &execution);
            return Ok(answer);
        }

        let mut solved_children = Vec::new();
        for child in children {
            if remaining_model_calls(self.get_model_calls(), self.get_max_model_calls()) <= 1 {
                self.record_limit(
                    &task,
                    "model call budget reached before all child tasks could be solved",
                );
                break;
            }
            let answer = Box::pin(self.solve_inner(&child, config, execution.clone())).await?;
            let summary =
                if remaining_model_calls(self.get_model_calls(), self.get_max_model_calls()) > 1 {
                    self.summarize(&child, &answer, execution.clone()).await?
                } else {
                    answer.clone()
                };
            solved_children.push(SolvedTask {
                id: child.id,
                prompt: child.prompt,
                answer,
                summary,
            });
        }

        let answer = if can_spend_any_model_call(self.get_model_calls(), self.get_max_model_calls())
        {
            self.synthesize(&task, &solved_children, execution.clone())
                .await?
        } else {
            self.synthesize_without_model(&task, &solved_children)
        };
        self.mark_execution_node_completed(&task.id, &execution);
        Ok(answer)
    }
}
