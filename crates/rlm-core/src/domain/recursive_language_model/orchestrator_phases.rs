use std::sync::Arc;

use super::engine_hosts::{EngineHost, QualityLoopHostAdapter};
use super::engine_state::fallback_from_messages_slice;
use super::execution_control::ExecutionControl;
use super::{RecursiveLanguageModel, DIRECT, RECURSIVE};
use crate::domain::recursion::{
    can_spend_any_model_call, clamp, limit_prompt, parse_first_integer,
    run_completion_with_tool_rounds, run_quality_loop, QUALITY_LOOP_PHASES,
};
use crate::domain::types::{
    ChatMessage, DepthMetadata, ExecutionStatus, NodeApprovalStatus, RecursiveModelConfig,
    RecursivePromptResult, SolvedTask, TaskNode,
};

impl RecursiveLanguageModel {
    pub(crate) async fn run_quality_loop_path(
        &self,
        prompt: &str,
        config: RecursiveModelConfig,
        execution: Option<Arc<dyn ExecutionControl>>,
    ) -> Result<RecursivePromptResult, String> {
        let loop_config = config.quality_loop.as_ref().filter(|q| q.enabled).cloned();
        let Some(loop_config) = loop_config else {
            return Err("quality loop config missing".into());
        };

        let mut effective = config.clone();
        effective.max_depth = effective.max_depth.or(Some(0));

        let root = {
            let mut state = self.state.lock().expect("engine lock");
            let id = state.create_id();
            TaskNode {
                id,
                parent_id: None,
                prompt: limit_prompt(prompt, &effective),
                depth: 0,
                kind: None,
                model_override: None,
            }
        };

        self.ensure_execution_node(&root, "quality-loop", prompt);
        self.set_execution_status(
            &execution,
            if execution.as_ref().is_some_and(|e| e.plan_only()) {
                ExecutionStatus::Planned
            } else {
                ExecutionStatus::Running
            },
        );
        self.emit_execution(
            &execution,
            if execution.as_ref().is_some_and(|e| e.plan_only()) {
                ExecutionStatus::Planned
            } else {
                ExecutionStatus::Running
            },
            Some(root.id.clone()),
            if execution.as_ref().is_some_and(|e| e.plan_only()) {
                "quality loop plan created"
            } else {
                "quality loop started"
            },
        );

        if execution.as_ref().is_some_and(|e| e.plan_only()) {
            let phase_count = QUALITY_LOOP_PHASES.len() as u32;
            {
                let mut state = self.state.lock().expect("engine lock");
                state.metadata.budget = Some(crate::domain::types::ExecutionBudget {
                    estimated_model_calls: loop_config
                        .max_iterations
                        .saturating_mul(phase_count)
                        .min(effective.max_model_calls),
                    estimated_tool_rounds: 0,
                    model_calls_used: 0,
                    model_calls_remaining: state.max_model_calls,
                    tool_calls_used: 0,
                });
            }
            self.update_execution_graph(&effective);
            return Ok(self.build_result());
        }

        let decision = self
            .wait_for_node_approval(&root, execution.clone())
            .await?;
        if decision.status == NodeApprovalStatus::Skipped {
            self.set_execution_status(&execution, ExecutionStatus::Skipped);
            self.update_execution_graph(&effective);
            return Ok(self.build_result());
        }

        let host = QualityLoopHostAdapter {
            engine: self,
            execution: execution.clone(),
            config: effective.clone(),
        };
        let answer = run_quality_loop(&host, &root, &effective).await;
        {
            let mut state = self.state.lock().expect("engine lock");
            state.metadata.model_calls = state.model_calls;
        }
        self.update_execution_graph(&effective);
        let mut result = self.build_result();
        result.answer = answer;
        Ok(result)
    }

    pub(crate) async fn classify(
        &self,
        task: &TaskNode,
        execution: Option<Arc<dyn ExecutionControl>>,
    ) -> Result<String, String> {
        let output = self
            .complete(
                task,
                "classify",
                vec![
                    ChatMessage {
                        role: "system".into(),
                        content: format!(
                            "Classify whether a prompt needs recursive decomposition. Respond with exactly {DIRECT} or {RECURSIVE}, then one short reason."
                        ),
                    },
                    ChatMessage {
                        role: "user".into(),
                        content: task.prompt.clone(),
                    },
                ],
                false,
                execution,
            )
            .await?;
        self.record(task, "classify", &task.prompt, &output);
        Ok(output
            .trim()
            .split(|c: char| c.is_whitespace() || c == ':' || c == '.' || c == '-')
            .next()
            .unwrap_or(DIRECT)
            .to_uppercase())
    }

    pub(crate) async fn decompose(
        &self,
        task: &TaskNode,
        config: &RecursiveModelConfig,
        execution: Option<Arc<dyn ExecutionControl>>,
    ) -> Result<Vec<TaskNode>, String> {
        let output = self
            .complete(
                task,
                "decompose",
                vec![
                    ChatMessage {
                        role: "system".into(),
                        content: format!(
                            "Break the user prompt into at most {} independent subtasks. Return one subtask per line. Do not number the lines. Keep each line concrete.",
                            config.max_branches
                        ),
                    },
                    ChatMessage {
                        role: "user".into(),
                        content: task.prompt.clone(),
                    },
                ],
                false,
                execution,
            )
            .await?;
        self.record(task, "decompose", &task.prompt, &output);

        let children: Vec<TaskNode> = output
            .lines()
            .map(|line| {
                line.trim().trim_start_matches(|c: char| {
                    c == '-' || c == '*' || c == '.' || c == ')' || c.is_ascii_digit()
                })
            })
            .filter(|line| !line.is_empty())
            .take(config.max_branches as usize)
            .map(|prompt| {
                let mut state = self.state.lock().expect("engine lock");
                let id = state.create_id();
                TaskNode {
                    id,
                    parent_id: Some(task.id.clone()),
                    prompt: limit_prompt(prompt, config),
                    depth: task.depth + 1,
                    kind: None,
                    model_override: None,
                }
            })
            .collect();

        for child in &children {
            self.ensure_execution_node(child, "task", &child.prompt);
            if let Some(parent) = child.parent_id.clone() {
                self.add_edge(&parent, &child.id);
            }
        }
        Ok(children)
    }

    pub(crate) async fn answer_directly(
        &self,
        task: &TaskNode,
        reason: &str,
        execution: Option<Arc<dyn ExecutionControl>>,
    ) -> Result<String, String> {
        if !can_spend_any_model_call(self.get_model_calls(), self.get_max_model_calls()) {
            self.record_limit(task, "model call budget reached before direct answer");
            return Ok(fallback_from_messages_slice(&[ChatMessage {
                role: "user".into(),
                content: task.prompt.clone(),
            }]));
        }
        let output = self
            .complete(
                task,
                "answer",
                vec![
                    ChatMessage {
                        role: "system".into(),
                        content: format!(
                            "Answer the user task directly and concisely. {reason} Prefer actionable, specific language over broad commentary."
                        ),
                    },
                    ChatMessage {
                        role: "user".into(),
                        content: task.prompt.clone(),
                    },
                ],
                true,
                execution,
            )
            .await?;
        self.record(task, "answer", &task.prompt, &output);
        Ok(output)
    }

    pub(crate) async fn summarize(
        &self,
        task: &TaskNode,
        answer: &str,
        execution: Option<Arc<dyn ExecutionControl>>,
    ) -> Result<String, String> {
        let output = self
            .complete(
                task,
                "summarize",
                vec![
                    ChatMessage {
                        role: "system".into(),
                        content: "Compress this solved subtask into the shortest useful summary for a parent synthesis step.".into(),
                    },
                    ChatMessage {
                        role: "user".into(),
                        content: format!("Subtask:\n{}\n\nAnswer:\n{answer}", task.prompt),
                    },
                ],
                false,
                execution,
            )
            .await?;
        self.record(task, "summarize", &task.prompt, &output);
        Ok(output)
    }

    pub(crate) async fn synthesize(
        &self,
        task: &TaskNode,
        solved_children: &[SolvedTask],
        execution: Option<Arc<dyn ExecutionControl>>,
    ) -> Result<String, String> {
        let child_context = solved_children
            .iter()
            .enumerate()
            .map(|(i, child)| {
                format!(
                    "Subtask {}: {}\nSummary: {}",
                    i + 1,
                    child.prompt,
                    child.summary
                )
            })
            .collect::<Vec<_>>()
            .join("\n\n");
        let output = self
            .complete(
                task,
                "synthesize",
                vec![
                    ChatMessage {
                        role: "system".into(),
                        content: "Synthesize the child task summaries into one final answer for the original prompt. Resolve conflicts directly and do not mention the recursion process unless it is relevant.".into(),
                    },
                    ChatMessage {
                        role: "user".into(),
                        content: format!(
                            "Original prompt:\n{}\n\nChild summaries:\n{child_context}",
                            task.prompt
                        ),
                    },
                ],
                true,
                execution,
            )
            .await?;
        self.record(task, "synthesize", &task.prompt, &output);
        Ok(output)
    }

    pub(crate) fn synthesize_without_model(
        &self,
        task: &TaskNode,
        solved_children: &[SolvedTask],
    ) -> String {
        let output = solved_children
            .iter()
            .map(|child| format!("{}: {}", child.prompt, child.summary))
            .collect::<Vec<_>>()
            .join("\n");
        self.record(task, "synthesize", &task.prompt, &output);
        output
    }

    pub(crate) async fn select_depth(
        &self,
        prompt: &str,
        config: &RecursiveModelConfig,
        execution: Option<Arc<dyn ExecutionControl>>,
    ) -> Result<i32, String> {
        if let Some(max_depth) = config.max_depth {
            let mut state = self.state.lock().expect("engine lock");
            state.metadata.depth = DepthMetadata {
                selected: max_depth,
                source: "override".into(),
            };
            return Ok(max_depth);
        }

        let max_dynamic_depth = config.max_dynamic_depth.max(0);
        if !can_spend_any_model_call(self.get_model_calls(), self.get_max_model_calls()) {
            let mut state = self.state.lock().expect("engine lock");
            state.metadata.depth = DepthMetadata {
                selected: 2,
                source: "fallback".into(),
            };
            return Ok(2);
        }

        let task = {
            let mut state = self.state.lock().expect("engine lock");
            let id = state.create_id();
            TaskNode {
                id,
                parent_id: None,
                prompt: limit_prompt(prompt, config),
                depth: 0,
                kind: None,
                model_override: None,
            }
        };
        self.ensure_execution_node(&task, "task", prompt);

        let decision = self
            .wait_for_node_approval(&task, execution.clone())
            .await?;
        if decision.status == NodeApprovalStatus::Skipped {
            let mut state = self.state.lock().expect("engine lock");
            state.metadata.depth = DepthMetadata {
                selected: 0,
                source: "fallback".into(),
            };
            return Ok(0);
        }

        self.mark_execution_node_running(&task.id, &execution);
        let output = self
            .complete(
                &task,
                "depth",
                vec![
                    ChatMessage {
                        role: "system".into(),
                        content: format!(
                            "Choose a recursion depth from 0 to {max_dynamic_depth} for the user's task complexity. Return only the integer."
                        ),
                    },
                    ChatMessage {
                        role: "user".into(),
                        content: task.prompt.clone(),
                    },
                ],
                false,
                execution.clone(),
            )
            .await?;
        let parsed = parse_first_integer(&output);
        let selected = clamp(parsed.unwrap_or(2), 0, max_dynamic_depth);
        let source = if parsed.is_none() {
            "fallback"
        } else {
            "model"
        };
        {
            let mut state = self.state.lock().expect("engine lock");
            state.metadata.depth = DepthMetadata {
                selected,
                source: source.into(),
            };
        }
        self.record(&task, "depth", &task.prompt, &output);
        self.mark_execution_node_completed(&task.id, &execution);
        Ok(selected)
    }

    pub(crate) async fn complete(
        &self,
        task: &TaskNode,
        kind: &str,
        messages: Vec<ChatMessage>,
        allow_tools: bool,
        execution: Option<Arc<dyn ExecutionControl>>,
    ) -> Result<String, String> {
        let host = EngineHost {
            engine: self,
            execution,
        };
        run_completion_with_tool_rounds(&host, task, kind, messages, allow_tools).await
    }
}
