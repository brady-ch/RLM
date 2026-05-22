use std::collections::HashMap;
use std::sync::{Arc, Mutex};

use async_trait::async_trait;

use crate::domain::recursion::{
    build_live_execution_metadata, can_spend_any_model_call, clamp,
    has_call_reserved_for_direct_answer, is_code_task, limit_prompt, parse_first_integer, preview,
    remaining_model_calls, run_completion_with_tool_rounds, run_quality_loop, ModelCompletionHost,
    QualityLoopHost, QUALITY_LOOP_PHASES,
};
use crate::domain::types::{
    ChatMessage, DepthMetadata, ExecutionEvent, ExecutionGraphEdge, ExecutionGraphNode,
    ExecutionStatus, ExecutionStatusUpdateDetail, NodeApprovalDecision, NodeApprovalStatus,
    QualityLoopManualDecision, QualityLoopMetadata, QualityLoopUsageSummary, RecursiveModelConfig,
    RecursivePromptMetadata, RecursivePromptResult, SolvedTask, TaskNode, TokenUsageTrace,
    TraceEvent,
};
use crate::ports::{LanguageModel, Tool, Trace};

const DIRECT: &str = "DIRECT";
const RECURSIVE: &str = "RECURSIVE";

mod engine_hosts;
mod engine_state;
mod execution_bridge;
mod execution_control;

use engine_hosts::{EngineHost, QualityLoopHostAdapter};
use engine_state::{empty_metadata, fallback_from_messages_slice, EngineState};

pub use execution_control::ExecutionControl;

pub struct RecursiveLanguageModel {
    pub(crate) model: Arc<dyn LanguageModel>,
    pub(crate) trace: Arc<dyn Trace>,
    pub(crate) tools: HashMap<String, Arc<dyn Tool>>,
    pub(crate) state: Mutex<EngineState>,
}

impl RecursiveLanguageModel {
    pub fn new(
        model: Arc<dyn LanguageModel>,
        trace: Arc<dyn Trace>,
        tools: Vec<Arc<dyn Tool>>,
    ) -> Self {
        let tools_map = tools
            .into_iter()
            .map(|t| (t.name().to_string(), t))
            .collect();
        Self {
            model,
            trace,
            tools: tools_map,
            state: Mutex::new(EngineState {
                next_id: 1,
                model_calls: 0,
                max_model_calls: u32::MAX,
                tool_round_limit: 0,
                agent_system_prompt: String::new(),
                metadata: empty_metadata(),
                execution_nodes: HashMap::new(),
                execution_edges: Vec::new(),
                tool_calls_len: 0,
                token_usage: TokenUsageTrace::default(),
            }),
        }
    }

    pub async fn run(
        &self,
        prompt: &str,
        config: RecursiveModelConfig,
        execution: Option<Arc<dyn ExecutionControl>>,
    ) -> Result<RecursivePromptResult, String> {
        {
            let mut state = self.state.lock().expect("engine lock");
            state.next_id = 1;
            state.model_calls = 0;
            state.max_model_calls = config.max_model_calls;
            state.tool_round_limit = config.max_tool_rounds;
            state.metadata = empty_metadata();
            state.execution_nodes.clear();
            state.execution_edges.clear();
            state.tool_calls_len = 0;
            state.agent_system_prompt.clear();
        }

        if config.quality_loop.as_ref().is_some_and(|q| q.enabled) {
            return self.run_quality_loop_path(prompt, config, execution).await;
        }

        let depth = self
            .select_depth(prompt, &config, execution.clone())
            .await?;
        let mut effective = config.clone();
        effective.max_depth = Some(depth);

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

        self.ensure_execution_node(&root, "task", prompt);
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
            ExecutionStatus::Running,
            Some(root.id.clone()),
            if execution.as_ref().is_some_and(|e| e.plan_only()) {
                "execution plan created"
            } else {
                "execution started"
            },
        );

        if execution.as_ref().is_some_and(|e| e.plan_only()) {
            self.update_execution_graph(&effective);
            return Ok(self.build_result());
        }

        match self.solve_inner(&root, &effective, execution.clone()).await {
            Ok(answer) => {
                self.sync_execution_status_with_outcome(&execution);
                {
                    let mut state = self.state.lock().expect("engine lock");
                    state.metadata.model_calls = state.model_calls;
                }
                self.update_execution_graph(&effective);
                let mut result = self.build_result();
                result.answer = answer;
                Ok(result)
            }
            Err(err) => {
                if !execution.as_ref().is_some_and(|e| e.is_cancelled()) {
                    self.set_execution_status(&execution, ExecutionStatus::Failed);
                }
                self.update_execution_graph(&effective);
                Err(err)
            }
        }
    }

    async fn run_quality_loop_path(
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

    async fn solve_inner(
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

    async fn classify(
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

    async fn decompose(
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

    async fn answer_directly(
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

    async fn summarize(
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

    async fn synthesize(
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

    fn synthesize_without_model(&self, task: &TaskNode, solved_children: &[SolvedTask]) -> String {
        let output = solved_children
            .iter()
            .map(|child| format!("{}: {}", child.prompt, child.summary))
            .collect::<Vec<_>>()
            .join("\n");
        self.record(task, "synthesize", &task.prompt, &output);
        output
    }

    async fn select_depth(
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

    async fn complete(
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

pub use crate::ports::trace::InMemoryTrace;
