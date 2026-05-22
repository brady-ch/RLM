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

#[async_trait]
pub trait ExecutionControl: Send + Sync {
    fn plan_only(&self) -> bool;
    fn is_cancelled(&self) -> bool;
    fn cancel_reason(&self) -> Option<String>;
    fn on_event(&self, event: ExecutionEvent);
    fn register_node(&self, node: ExecutionGraphNode);
    fn update_node_status(
        &self,
        node_id: &str,
        status: ExecutionStatus,
        detail: Option<ExecutionStatusUpdateDetail>,
    );
    async fn wait_for_node_approval(&self, node: ExecutionGraphNode) -> NodeApprovalDecision;
    fn get_quality_loop_decision(&self, _node_id: &str) -> Option<QualityLoopManualDecision> {
        None
    }
}

pub struct RecursiveLanguageModel {
    model: Arc<dyn LanguageModel>,
    trace: Arc<dyn Trace>,
    tools: HashMap<String, Arc<dyn Tool>>,
    state: Mutex<EngineState>,
}

struct EngineState {
    next_id: u32,
    model_calls: u32,
    max_model_calls: u32,
    tool_round_limit: u32,
    agent_system_prompt: String,
    metadata: RecursivePromptMetadata,
    execution_nodes: HashMap<String, ExecutionGraphNode>,
    execution_edges: Vec<ExecutionGraphEdge>,
    tool_calls_len: u32,
    token_usage: TokenUsageTrace,
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

    fn build_result(&self) -> RecursivePromptResult {
        let state = self.state.lock().expect("engine lock");
        RecursivePromptResult {
            answer: String::new(),
            trace: self.trace.events(),
            metadata: state.metadata.clone(),
        }
    }

    fn get_model_calls(&self) -> u32 {
        self.state.lock().expect("engine lock").model_calls
    }

    fn get_max_model_calls(&self) -> u32 {
        self.state.lock().expect("engine lock").max_model_calls
    }

    fn record(&self, task: &TaskNode, kind: &str, prompt: &str, output: &str) {
        let event = TraceEvent {
            id: task.id.clone(),
            parent_id: task.parent_id.clone(),
            depth: task.depth,
            kind: kind.into(),
            prompt: prompt.into(),
            output: output.into(),
        };
        self.trace.record(event);
    }

    fn record_limit(&self, task: &TaskNode, message: &str) {
        self.record(task, "error", &task.prompt, message);
        self.state
            .lock()
            .expect("engine lock")
            .metadata
            .errors
            .push(message.into());
    }

    fn ensure_execution_node(&self, task: &TaskNode, kind: &str, label_source: &str) {
        let node = ExecutionGraphNode {
            id: task.id.clone(),
            parent_id: task.parent_id.clone(),
            kind: kind.into(),
            label: preview(label_source, 80),
            prompt: Some(task.prompt.clone()),
            depth: task.depth,
            status: ExecutionStatus::Planned,
            model_override: task.model_override.clone(),
            ..Default::default()
        };
        let mut state = self.state.lock().expect("engine lock");
        state.execution_nodes.insert(task.id.clone(), node);
    }

    fn add_edge(&self, from: &str, to: &str) {
        let mut state = self.state.lock().expect("engine lock");
        if !state
            .execution_edges
            .iter()
            .any(|e| e.from == from && e.to == to)
        {
            state.execution_edges.push(ExecutionGraphEdge {
                from: from.into(),
                to: to.into(),
                source_handle: None,
                target_handle: None,
            });
        }
    }

    fn update_execution_graph(&self, config: &RecursiveModelConfig) {
        let mut state = self.state.lock().expect("engine lock");
        let (graph, budget) = build_live_execution_metadata(
            &state.execution_nodes,
            &state.execution_edges,
            state.model_calls,
            state.max_model_calls,
            state.tool_calls_len,
            state.tool_round_limit,
            Some(config),
        );
        state.metadata.execution_graph = Some(graph);
        state.metadata.budget = Some(budget);
    }

    async fn wait_for_node_approval(
        &self,
        task: &TaskNode,
        execution: Option<Arc<dyn ExecutionControl>>,
    ) -> Result<NodeApprovalDecision, String> {
        let node = ExecutionGraphNode {
            id: task.id.clone(),
            parent_id: task.parent_id.clone(),
            kind: "task".into(),
            label: preview(&task.prompt, 80),
            prompt: Some(task.prompt.clone()),
            depth: task.depth,
            status: ExecutionStatus::Planned,
            model_override: task.model_override.clone(),
            ..Default::default()
        };
        if let Some(ctrl) = execution {
            Ok(ctrl.wait_for_node_approval(node).await)
        } else {
            Ok(NodeApprovalDecision {
                status: NodeApprovalStatus::Approved,
                prompt: task.prompt.clone(),
                model_override: None,
            })
        }
    }

    fn throw_if_cancelled(
        &self,
        _task: &TaskNode,
        execution: &Option<Arc<dyn ExecutionControl>>,
    ) -> Result<(), String> {
        if execution.as_ref().is_some_and(|e| e.is_cancelled()) {
            Err(execution
                .as_ref()
                .and_then(|e| e.cancel_reason())
                .unwrap_or_else(|| "Run was cancelled.".into()))
        } else {
            Ok(())
        }
    }

    fn emit_execution(
        &self,
        execution: &Option<Arc<dyn ExecutionControl>>,
        status: ExecutionStatus,
        node_id: Option<String>,
        message: &str,
    ) {
        if let Some(ctrl) = execution {
            let mut event = ExecutionEvent::execution(status);
            event.node_id = node_id;
            event.message = Some(message.into());
            event.model_calls_used = Some(self.get_model_calls());
            event.model_calls_remaining = Some(remaining_model_calls(
                self.get_model_calls(),
                self.get_max_model_calls(),
            ));
            ctrl.on_event(event);
        }
    }

    fn set_execution_status(
        &self,
        execution: &Option<Arc<dyn ExecutionControl>>,
        status: ExecutionStatus,
    ) {
        let mut state = self.state.lock().expect("engine lock");
        state.metadata.execution_status = Some(status);
        drop(state);
        self.emit_execution(execution, status, None, "execution status updated");
    }

    fn sync_execution_status_with_outcome(&self, execution: &Option<Arc<dyn ExecutionControl>>) {
        let status = {
            let state = self.state.lock().expect("engine lock");
            let failed = state
                .execution_nodes
                .values()
                .any(|n| n.status == ExecutionStatus::Failed);
            if failed {
                ExecutionStatus::Failed
            } else {
                ExecutionStatus::Completed
            }
        };
        self.set_execution_status(execution, status);
    }

    fn mark_execution_node_running(
        &self,
        node_id: &str,
        execution: &Option<Arc<dyn ExecutionControl>>,
    ) {
        self.update_node(node_id, ExecutionStatus::Running, execution);
    }

    fn mark_execution_node_completed(
        &self,
        node_id: &str,
        execution: &Option<Arc<dyn ExecutionControl>>,
    ) {
        self.update_node(node_id, ExecutionStatus::Completed, execution);
    }

    fn update_node(
        &self,
        node_id: &str,
        status: ExecutionStatus,
        execution: &Option<Arc<dyn ExecutionControl>>,
    ) {
        {
            let mut state = self.state.lock().expect("engine lock");
            if let Some(node) = state.execution_nodes.get_mut(node_id) {
                node.status = status;
            }
        }
        if let Some(ctrl) = execution {
            ctrl.update_node_status(node_id, status, None);
        }
    }

    fn write_loop_metadata(
        &self,
        node_id: &str,
        metadata: &QualityLoopMetadata,
        execution: &Option<Arc<dyn ExecutionControl>>,
    ) {
        let node_snapshot = {
            let mut state = self.state.lock().expect("engine lock");
            state.metadata.quality_loop = Some(metadata.clone());
            if let Some(node) = state.execution_nodes.get_mut(node_id) {
                node.r#loop = Some(metadata.clone());
                Some(node.clone())
            } else {
                None
            }
        };
        if let (Some(node), Some(ctrl)) = (node_snapshot, execution) {
            ctrl.register_node(node);
        }
    }

    fn summarize_quality_loop_usage(
        &self,
        metadata: &QualityLoopMetadata,
        model_calls_total: Option<u32>,
    ) -> QualityLoopUsageSummary {
        let state = self.state.lock().expect("engine lock");
        let mut usage = metadata.usage.clone();
        usage.model_calls_total = model_calls_total.unwrap_or_else(|| {
            usage.phase_call_counts.draft
                + usage.phase_call_counts.critique
                + usage.phase_call_counts.refine
                + usage.phase_call_counts.gate
                + usage.phase_call_counts.best_of_progress
        });
        usage.input_tokens = state.token_usage.input_tokens;
        usage.output_tokens = state.token_usage.output_tokens;
        usage.total_tokens = state.token_usage.total_tokens;
        usage.unknown_completions = state.token_usage.unknown_completions;
        usage
    }
}

struct QualityLoopHostAdapter<'a> {
    engine: &'a RecursiveLanguageModel,
    execution: Option<Arc<dyn ExecutionControl>>,
    config: RecursiveModelConfig,
}

#[async_trait]
impl QualityLoopHost for QualityLoopHostAdapter<'_> {
    fn model(&self) -> &dyn LanguageModel {
        self.engine.model.as_ref()
    }

    fn get_model_calls(&self) -> u32 {
        self.engine.get_model_calls()
    }

    fn get_max_model_calls(&self) -> u32 {
        self.engine.get_max_model_calls()
    }

    fn consume_model_call(&self) {
        self.engine.state.lock().expect("engine lock").model_calls += 1;
    }

    fn get_tool_calls_used_count(&self) -> u32 {
        self.engine
            .state
            .lock()
            .expect("engine lock")
            .tool_calls_len
    }

    fn get_token_usage(&self) -> TokenUsageTrace {
        self.engine
            .state
            .lock()
            .expect("engine lock")
            .token_usage
            .clone()
    }

    fn get_depth_selected(&self) -> i32 {
        self.engine
            .state
            .lock()
            .expect("engine lock")
            .metadata
            .depth
            .selected
    }

    fn throw_if_cancelled(&self, task: &TaskNode) -> Result<(), String> {
        self.engine.throw_if_cancelled(task, &self.execution)
    }

    fn is_execution_cancelled(&self) -> bool {
        self.execution.as_ref().is_some_and(|e| e.is_cancelled())
    }

    fn push_metadata_error(&self, message: &str) {
        self.engine
            .state
            .lock()
            .expect("engine lock")
            .metadata
            .errors
            .push(message.into());
    }

    fn emit_execution(&self, event: ExecutionEvent) {
        if let Some(ctrl) = &self.execution {
            ctrl.on_event(event);
        }
    }

    fn write_loop_metadata(&self, node_id: &str, metadata: &QualityLoopMetadata) {
        self.engine
            .write_loop_metadata(node_id, metadata, &self.execution);
        self.engine.update_execution_graph(&self.config);
    }

    fn mark_execution_node_running(&self, node_id: &str) {
        self.engine
            .mark_execution_node_running(node_id, &self.execution);
    }

    fn mark_execution_node_completed(&self, node_id: &str) {
        self.engine
            .mark_execution_node_completed(node_id, &self.execution);
    }

    fn mark_execution_node_failed(
        &self,
        node_id: &str,
        status: ExecutionStatus,
        detail: Option<ExecutionStatusUpdateDetail>,
    ) {
        {
            let mut state = self.engine.state.lock().expect("engine lock");
            if let Some(node) = state.execution_nodes.get_mut(node_id) {
                node.status = status;
            }
        }
        if let Some(ctrl) = &self.execution {
            ctrl.update_node_status(node_id, status, detail);
        }
    }

    fn set_metadata_execution_status(&self, status: ExecutionStatus) {
        self.engine.set_execution_status(&self.execution, status);
    }

    fn summarize_quality_loop_usage(
        &self,
        metadata: &QualityLoopMetadata,
        model_calls_total: Option<u32>,
    ) -> QualityLoopUsageSummary {
        self.engine
            .summarize_quality_loop_usage(metadata, model_calls_total)
    }

    fn with_agent_system_prompt(&self, messages: Vec<ChatMessage>) -> Vec<ChatMessage> {
        let prompt = self
            .engine
            .state
            .lock()
            .expect("engine lock")
            .agent_system_prompt
            .clone();
        if prompt.is_empty() {
            messages
        } else {
            let mut out = vec![ChatMessage {
                role: "system".into(),
                content: prompt,
            }];
            out.extend(messages);
            out
        }
    }

    fn update_execution_node_model(&self, node_id: &str, effective_model: Option<String>) {
        if let Some(model) = effective_model {
            let mut state = self.engine.state.lock().expect("engine lock");
            if let Some(node) = state.execution_nodes.get_mut(node_id) {
                let _ = model;
                let _ = node;
            }
        }
    }

    fn get_quality_loop_decision(&self, node_id: &str) -> Option<QualityLoopManualDecision> {
        self.execution
            .as_ref()
            .and_then(|ctrl| ctrl.get_quality_loop_decision(node_id))
    }
}

struct EngineHost<'a> {
    engine: &'a RecursiveLanguageModel,
    execution: Option<Arc<dyn ExecutionControl>>,
}

#[async_trait]
impl ModelCompletionHost for EngineHost<'_> {
    fn get_model_calls(&self) -> u32 {
        self.engine.get_model_calls()
    }

    fn get_max_model_calls(&self) -> u32 {
        self.engine.get_max_model_calls()
    }

    fn get_tool_round_limit(&self) -> u32 {
        self.engine
            .state
            .lock()
            .expect("engine lock")
            .tool_round_limit
    }

    fn consume_model_call(&self) {
        self.engine.state.lock().expect("engine lock").model_calls += 1;
    }

    fn throw_if_cancelled(&self, task: &TaskNode) -> Result<(), String> {
        self.engine.throw_if_cancelled(task, &self.execution)
    }

    fn record_limit(&self, task: &TaskNode, message: &str) {
        self.engine.record_limit(task, message);
    }

    fn record(&self, task: &TaskNode, kind: &str, prompt: &str, output: &str) {
        self.engine.record(task, kind, prompt, output);
    }

    fn push_metadata_error(&self, message: &str) {
        self.engine
            .state
            .lock()
            .expect("engine lock")
            .metadata
            .errors
            .push(message.into());
    }

    fn mark_execution_node_failed(
        &self,
        node_id: &str,
        _status: &str,
        detail: Option<ExecutionStatusUpdateDetail>,
    ) {
        if let Some(ctrl) = &self.execution {
            ctrl.update_node_status(node_id, ExecutionStatus::Failed, detail);
        }
    }

    fn tools_for_task(&self, _task: &TaskNode) -> Vec<Arc<dyn Tool>> {
        self.engine.tools.values().cloned().collect()
    }

    fn get_tool_by_name(&self, name: &str) -> Option<Arc<dyn Tool>> {
        self.engine.tools.get(name).cloned()
    }

    async fn request_clarification(
        &self,
        task: &TaskNode,
        _prompt_text: &str,
    ) -> Result<String, String> {
        if let Some(ctrl) = &self.execution {
            let node = ExecutionGraphNode {
                id: task.id.clone(),
                parent_id: task.parent_id.clone(),
                kind: "task".into(),
                label: preview(&task.prompt, 80),
                prompt: Some(task.prompt.clone()),
                depth: task.depth,
                status: ExecutionStatus::AwaitingApproval,
                ..Default::default()
            };
            ctrl.register_node(node);
            ctrl.update_node_status(
                &task.id,
                ExecutionStatus::AwaitingApproval,
                Some(ExecutionStatusUpdateDetail {
                    failure_category: None,
                    code: None,
                    message: Some("clarification required".into()),
                }),
            );
        }
        // Without session wiring, auto-approve clarification with empty answer path is not used in tests.
        Ok(String::new())
    }

    fn model(&self) -> &dyn LanguageModel {
        self.engine.model.as_ref()
    }

    fn with_agent_system_prompt(&self, messages: Vec<ChatMessage>) -> Vec<ChatMessage> {
        let prompt = self
            .engine
            .state
            .lock()
            .expect("engine lock")
            .agent_system_prompt
            .clone();
        if prompt.is_empty() {
            messages
        } else {
            let mut out = vec![ChatMessage {
                role: "system".into(),
                content: prompt,
            }];
            out.extend(messages);
            out
        }
    }
}

impl EngineState {
    fn create_id(&mut self) -> String {
        let id = format!("task-{}", self.next_id);
        self.next_id += 1;
        id
    }
}

fn empty_metadata() -> RecursivePromptMetadata {
    RecursivePromptMetadata {
        depth: DepthMetadata {
            selected: 0,
            source: "unset".into(),
        },
        execution_status: None,
        execution_graph: None,
        budget: None,
        model_calls: 0,
        errors: Vec::new(),
        quality_loop: None,
    }
}

fn fallback_from_messages_slice(messages: &[ChatMessage]) -> String {
    crate::domain::recursion::fallback_from_messages(messages)
}

// Re-export trace from ports for convenience in tests
pub use crate::ports::trace::InMemoryTrace;
