use std::collections::{HashMap, HashSet};
use std::sync::{Arc, Mutex};

use async_trait::async_trait;
use tokio::sync::{broadcast, oneshot};
use uuid::Uuid;

use crate::domain::recursive_language_model::ExecutionControl;
use crate::domain::types::{
    approval_mode_label, ApprovalMode, ChatReadiness, ChatSnapshot, ClarificationQuestion,
    ClarificationRecord, DeleteStrategy, ExecutionEvent, ExecutionGraph, ExecutionGraphEdge,
    ExecutionGraphNode, ExecutionStatus, ExecutionStatusUpdateDetail, GraphViewport,
    GraphWorkflowMetadata, NodeApprovalDecision, NodeApprovalStatus, QualityLoopManualDecision,
    RunModeSnapshot, RunSummary, SessionSnapshot,
};

use super::cancellation::CancellationController;

type ApprovalWaiter = oneshot::Sender<NodeApprovalDecision>;

#[derive(Debug, Clone)]
pub(crate) enum PendingMutationKind {
    Edit {
        node_id: String,
        prompt: String,
    },
    Delete {
        node_id: String,
        strategy: Option<DeleteStrategy>,
    },
}

#[derive(Debug, Clone)]
pub(crate) struct PendingChatMutation {
    pub id: String,
    pub mutation: PendingMutationKind,
    pub proposal: serde_json::Value,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum RunLifecycle {
    Idle,
    Running,
}

pub(crate) struct PendingApproval {
    pub(crate) token: String,
    pub(crate) sender: ApprovalWaiter,
}

pub struct InteractiveExecutionSession {
    pub(crate) nodes: Mutex<HashMap<String, ExecutionGraphNode>>,
    pub(crate) edges: Mutex<Vec<ExecutionGraphEdge>>,
    pub(crate) viewport: Mutex<GraphViewport>,
    pub(crate) pending: Mutex<HashMap<String, PendingApproval>>,
    pub(crate) resolved_tokens: Mutex<HashSet<String>>,
    approval_mode: Mutex<ApprovalMode>,
    auto_approval_paused: Mutex<bool>,
    initial_plan_accepted: Mutex<bool>,
    approval_version: Mutex<u32>,
    auto_approve_next_root: Mutex<bool>,
    run_lifecycle: Mutex<RunLifecycle>,
    pub(crate) graph_workflow_metadata: Mutex<Option<GraphWorkflowMetadata>>,
    cancellation: CancellationController,
    pub(crate) pending_clarification: Mutex<Option<ClarificationQuestion>>,
    clarification_history: Mutex<Vec<ClarificationRecord>>,
    clarification_waiter: Mutex<Option<(String, oneshot::Sender<String>)>>,
    pub(crate) pending_mutation: Mutex<Option<PendingChatMutation>>,
    pub(crate) mutation_version: Mutex<u32>,
    quality_loop_decisions: Mutex<HashMap<String, QualityLoopManualDecision>>,
    event_tx: broadcast::Sender<ExecutionEvent>,
}

impl InteractiveExecutionSession {
    pub fn new(approval_mode: ApprovalMode) -> Arc<Self> {
        let (event_tx, _) = broadcast::channel(256);
        Arc::new(Self {
            nodes: Mutex::new(HashMap::new()),
            edges: Mutex::new(Vec::new()),
            viewport: Mutex::new(GraphViewport::default()),
            pending: Mutex::new(HashMap::new()),
            resolved_tokens: Mutex::new(HashSet::new()),
            approval_mode: Mutex::new(approval_mode),
            auto_approval_paused: Mutex::new(false),
            initial_plan_accepted: Mutex::new(false),
            approval_version: Mutex::new(0),
            auto_approve_next_root: Mutex::new(false),
            run_lifecycle: Mutex::new(RunLifecycle::Idle),
            graph_workflow_metadata: Mutex::new(None),
            cancellation: CancellationController::new(),
            pending_clarification: Mutex::new(None),
            clarification_history: Mutex::new(Vec::new()),
            clarification_waiter: Mutex::new(None),
            pending_mutation: Mutex::new(None),
            mutation_version: Mutex::new(0),
            quality_loop_decisions: Mutex::new(HashMap::new()),
            event_tx,
        })
    }

    pub fn subscribe(&self) -> broadcast::Receiver<ExecutionEvent> {
        self.event_tx.subscribe()
    }

    pub fn snapshot(&self) -> SessionSnapshot {
        let nodes: Vec<_> = self
            .nodes
            .lock()
            .expect("nodes")
            .values()
            .cloned()
            .collect();
        let edges = self.edges.lock().expect("edges").clone();
        let viewport = self.viewport.lock().expect("viewport").clone();
        let active_node = nodes
            .iter()
            .find(|n| {
                n.status == ExecutionStatus::AwaitingApproval
                    || n.status == ExecutionStatus::Running
            })
            .map(|n| n.id.clone());

        let terminal = !nodes.is_empty()
            && nodes.iter().all(|n| {
                matches!(
                    n.status,
                    ExecutionStatus::Completed
                        | ExecutionStatus::Skipped
                        | ExecutionStatus::Failed
                        | ExecutionStatus::Cancelled
                )
            });

        let status = if self.cancellation.is_cancelled() {
            ExecutionStatus::Cancelled
        } else if !terminal {
            active_node
                .as_ref()
                .and_then(|id| self.nodes.lock().expect("nodes").get(id).map(|n| n.status))
                .unwrap_or(ExecutionStatus::Planned)
        } else if nodes.iter().any(|n| n.status == ExecutionStatus::Failed) {
            ExecutionStatus::Failed
        } else {
            ExecutionStatus::Completed
        };

        let run_summary =
            if terminal && matches!(status, ExecutionStatus::Failed | ExecutionStatus::Cancelled) {
                Some(RunSummary {
                    message: Some(if status == ExecutionStatus::Cancelled {
                        self.cancellation
                            .cancel_reason()
                            .unwrap_or_else(|| "Run was cancelled.".into())
                    } else {
                        "Run failed.".into()
                    }),
                })
            } else {
                None
            };

        SessionSnapshot {
            graph: ExecutionGraph {
                nodes,
                edges,
                viewport: Some(viewport),
            },
            status,
            active_node_id: active_node,
            approval_mode: *self.approval_mode.lock().expect("approval_mode"),
            auto_approval_paused: *self
                .auto_approval_paused
                .lock()
                .expect("auto_approval_paused"),
            run_summary,
            chat: ChatSnapshot {
                readiness: ChatReadiness::Structured {
                    state: "draft".into(),
                    reason: "Draft graph: confirm graph and run to start execution.".into(),
                },
                pending_mutation: self
                    .pending_mutation
                    .lock()
                    .expect("pending_mutation")
                    .as_ref()
                    .map(|pending| pending.proposal.clone()),
                pending_clarification: self.pending_clarification.lock().expect("clarify").clone(),
                clarification_history: self.clarification_history.lock().expect("history").clone(),
            },
        }
    }

    pub fn run_mode_snapshot(&self) -> RunModeSnapshot {
        let mode = *self.approval_mode.lock().expect("approval_mode");
        RunModeSnapshot {
            approval_mode: mode,
            approval_mode_label: approval_mode_label(mode).into(),
            auto_approval_paused: *self
                .auto_approval_paused
                .lock()
                .expect("auto_approval_paused"),
        }
    }

    pub fn begin_confirmed_execution(&self) {
        *self.auto_approve_next_root.lock().expect("auto") = true;
        *self.run_lifecycle.lock().expect("lifecycle") = RunLifecycle::Running;
    }

    pub fn finish_confirmed_execution(&self) {
        *self.run_lifecycle.lock().expect("lifecycle") = RunLifecycle::Idle;
        *self.auto_approve_next_root.lock().expect("auto") = false;
    }

    pub fn is_confirmed_execution_running(&self) -> bool {
        *self.run_lifecycle.lock().expect("lifecycle") == RunLifecycle::Running
    }

    pub fn register_node_for_test(&self, node: ExecutionGraphNode) {
        self.register_node_internal(node);
    }

    pub fn register_pending_clarification_for_test(&self, question: ClarificationQuestion) {
        *self.pending_clarification.lock().expect("clarify") = Some(question);
    }

    pub(crate) fn register_node_internal(&self, node: ExecutionGraphNode) {
        self.nodes
            .lock()
            .expect("nodes")
            .insert(node.id.clone(), node);
    }

    pub fn approve_node(&self, node_id: &str, token: Option<&str>) -> Result<bool, String> {
        let mut pending = self.pending.lock().expect("pending");
        let Some(wait) = pending.remove(node_id) else {
            if let Some(token) = token {
                if self.resolved_tokens.lock().expect("tokens").contains(token) {
                    return Ok(true);
                }
            }
            return Err(format!("Node \"{node_id}\" is not awaiting approval."));
        };

        if let Some(token) = token {
            if token != wait.token {
                pending.insert(node_id.to_string(), wait);
                return Err(format!("Stale approval token for node \"{node_id}\"."));
            }
        }

        self.resolved_tokens
            .lock()
            .expect("tokens")
            .insert(wait.token.clone());
        {
            let mut nodes = self.nodes.lock().expect("nodes");
            if let Some(node) = nodes.get_mut(node_id) {
                node.approval_token = None;
                node.approval_source = Some("manual".into());
                node.approval_reason = Some("manually approved".into());
                node.status = ExecutionStatus::Approved;
            }
        }
        *self.initial_plan_accepted.lock().expect("initial") = true;
        let node = self.nodes.lock().expect("nodes").get(node_id).cloned();
        let _ = wait.sender.send(NodeApprovalDecision {
            status: NodeApprovalStatus::Approved,
            prompt: node
                .as_ref()
                .and_then(|n| n.prompt.clone())
                .unwrap_or_default(),
            model_override: node.and_then(|n| n.model_override),
        });
        Ok(false)
    }

    pub(crate) fn set_quality_loop_decision(&self, node_id: &str, action: &str, reason: &str) {
        self.quality_loop_decisions
            .lock()
            .expect("quality_loop_decisions")
            .insert(
                node_id.to_string(),
                QualityLoopManualDecision {
                    action: action.into(),
                    reason: reason.into(),
                    requested_at: time::OffsetDateTime::now_utc()
                        .format(&time::format_description::well_known::Rfc3339)
                        .unwrap_or_else(|_| "1970-01-01T00:00:00Z".into()),
                    source: "user".into(),
                },
            );
    }

    pub fn stop(&self, reason: impl Into<String>) {
        let reason = reason.into();
        self.cancellation.cancel(reason.clone());

        if let Some((_, waiter)) = self.clarification_waiter.lock().expect("waiter").take() {
            let _ = waiter.send(String::new());
        }
        *self.pending_clarification.lock().expect("clarify") = None;

        let mut pending = self.pending.lock().expect("pending");
        for (node_id, wait) in pending.drain() {
            if let Some(node) = self.nodes.lock().expect("nodes").get_mut(&node_id) {
                node.status = ExecutionStatus::Cancelled;
                node.approval_token = None;
            }
            let prompt = self
                .nodes
                .lock()
                .expect("nodes")
                .get(&node_id)
                .and_then(|n| n.prompt.clone())
                .unwrap_or_default();
            let _ = wait.sender.send(NodeApprovalDecision {
                status: NodeApprovalStatus::Cancelled,
                prompt,
                model_override: None,
            });
        }

        let mut event = ExecutionEvent::execution(ExecutionStatus::Cancelled);
        event.message = Some(reason);
        event.failure_category = Some("cancelled".into());
        event.code = Some("cancelled".into());
        let _ = self.event_tx.send(event);
    }

    pub fn pause_future_auto_approvals(&self) {
        *self.auto_approval_paused.lock().expect("auto") = true;
        let mut event = ExecutionEvent::execution(ExecutionStatus::Ready);
        event.message = Some("future auto-approvals paused".into());
        event.approval_mode = Some(*self.approval_mode.lock().expect("approval_mode"));
        let _ = self.event_tx.send(event);
    }

    pub fn answer_clarification(&self, question_id: &str, user_answer: &str) -> Result<(), String> {
        let pending = self.pending_clarification.lock().expect("clarify").clone();
        let Some(pending) = pending else {
            return Err("Unknown or resolved clarification question.".into());
        };
        if pending.question_id != question_id {
            return Err("Unknown or resolved clarification question.".into());
        }
        let answer = user_answer.trim();
        if answer.is_empty() {
            return Err("Clarification answer cannot be empty.".into());
        }

        let record = ClarificationRecord {
            question_id: pending.question_id.clone(),
            node_id: pending.node_id.clone(),
            prompt_text: pending.prompt_text.clone(),
            user_answer: answer.to_string(),
            asked_at: pending.asked_at.clone(),
            answered_at: time::OffsetDateTime::now_utc()
                .format(&time::format_description::well_known::Rfc3339)
                .unwrap_or_else(|_| "now".into()),
            resume_event_id: format!("{}:resume:{}", pending.node_id, Uuid::new_v4()),
        };
        self.clarification_history
            .lock()
            .expect("history")
            .push(record.clone());
        *self.pending_clarification.lock().expect("clarify") = None;

        if let Some((id, waiter)) = self.clarification_waiter.lock().expect("waiter").take() {
            if id == pending.question_id {
                let _ = waiter.send(answer.to_string());
            }
        }

        if let Some(node) = self.nodes.lock().expect("nodes").get_mut(&pending.node_id) {
            node.status = ExecutionStatus::Approved;
        }

        let mut event = ExecutionEvent::execution(ExecutionStatus::Approved);
        event.node_id = Some(pending.node_id);
        event.message = Some("clarification answered; resuming".into());
        event.clarification_record = Some(record);
        let _ = self.event_tx.send(event);
        Ok(())
    }

    pub(crate) fn publish(&self, mut event: ExecutionEvent) {
        if event.event_type.is_empty() {
            event.event_type = "execution".into();
        }
        let _ = self.event_tx.send(event);
    }

    fn should_auto_approve(&self, node: &ExecutionGraphNode) -> (bool, String) {
        if *self.auto_approve_next_root.lock().expect("auto")
            && node.depth == 0
            && !node.spawned_after_initial_approval.unwrap_or(false)
        {
            *self.auto_approve_next_root.lock().expect("auto") = false;
            return (true, "graph confirmed for run".into());
        }

        if *self.approval_mode.lock().expect("approval_mode") == ApprovalMode::Full
            || *self.auto_approval_paused.lock().expect("auto")
        {
            return (false, "full checkpoint approval required".into());
        }

        if !*self.initial_plan_accepted.lock().expect("initial") {
            return (false, "initial checkpoint approval required".into());
        }

        if *self.approval_mode.lock().expect("approval_mode") == ApprovalMode::InitialPlan {
            if node.spawned_after_initial_approval.unwrap_or(false) {
                return (false, "new recursive branch requires approval".into());
            }
            return (true, "initial plan approved".into());
        }

        (
            true,
            if node.spawned_after_initial_approval.unwrap_or(false) {
                "recursive branch auto-approved".into()
            } else {
                "initial plan approved".into()
            },
        )
    }

    async fn wait_for_node_approval_internal(
        self: &Arc<Self>,
        input: ExecutionGraphNode,
    ) -> NodeApprovalDecision {
        if self
            .pending_clarification
            .lock()
            .expect("clarify")
            .as_ref()
            .is_some_and(|clarify| clarify.node_id != input.id)
        {
            self.register_node_internal(input.clone());
            self.update_node_status_internal(
                &input.id,
                ExecutionStatus::AwaitingApproval,
                Some(ExecutionStatusUpdateDetail {
                    failure_category: None,
                    code: None,
                    message: Some("blocked by unresolved clarification checkpoint".into()),
                }),
            );
            loop {
                if self.cancellation.is_cancelled() {
                    return NodeApprovalDecision {
                        status: NodeApprovalStatus::Cancelled,
                        prompt: input.prompt.clone().unwrap_or_default(),
                        model_override: None,
                    };
                }
                if self
                    .pending_clarification
                    .lock()
                    .expect("clarify")
                    .is_none()
                {
                    break;
                }
                tokio::time::sleep(std::time::Duration::from_millis(25)).await;
            }
            return Box::pin(Arc::clone(self).wait_for_node_approval_internal(input)).await;
        }

        self.register_node_internal(input.clone());
        let node = self
            .nodes
            .lock()
            .expect("nodes")
            .get(&input.id)
            .cloned()
            .unwrap_or(input.clone());

        let (auto, reason) = self.should_auto_approve(&node);
        if auto {
            if let Some(n) = self.nodes.lock().expect("nodes").get_mut(&input.id) {
                n.approval_token = None;
                n.approval_source = Some("auto".into());
                n.approval_reason = Some(reason.clone());
                n.status = ExecutionStatus::Approved;
            }
            let mut event = ExecutionEvent::execution(ExecutionStatus::Approved);
            event.node_id = Some(input.id.clone());
            event.message = Some("node auto-approved".into());
            event.approval_mode = Some(*self.approval_mode.lock().expect("approval_mode"));
            event.approval_source = Some("auto".into());
            self.publish(event);
            return NodeApprovalDecision {
                status: NodeApprovalStatus::Approved,
                prompt: node.prompt.clone().unwrap_or(node.label),
                model_override: node.model_override,
            };
        }

        let token = {
            let mut version = self.approval_version.lock().expect("version");
            *version += 1;
            format!("{}:{}", input.id, *version)
        };
        if let Some(n) = self.nodes.lock().expect("nodes").get_mut(&input.id) {
            n.approval_token = Some(token.clone());
            n.approval_reason = Some(reason);
            n.status = ExecutionStatus::AwaitingApproval;
        }
        self.publish(ExecutionEvent::execution(ExecutionStatus::AwaitingApproval));

        let (tx, rx) = oneshot::channel();
        self.pending
            .lock()
            .expect("pending")
            .insert(input.id.clone(), PendingApproval { token, sender: tx });
        rx.await.unwrap_or(NodeApprovalDecision {
            status: NodeApprovalStatus::Cancelled,
            prompt: String::new(),
            model_override: None,
        })
    }

    pub(crate) fn update_node_status_internal(
        &self,
        node_id: &str,
        status: ExecutionStatus,
        detail: Option<ExecutionStatusUpdateDetail>,
    ) {
        if let Some(node) = self.nodes.lock().expect("nodes").get_mut(node_id) {
            node.status = status;
        }
        let mut event = ExecutionEvent::execution(status);
        event.node_id = Some(node_id.to_string());
        event.message = detail.as_ref().and_then(|d| d.message.clone());
        event.failure_category = detail.as_ref().and_then(|d| d.failure_category.clone());
        event.code = detail.as_ref().and_then(|d| d.code.clone());
        self.publish(event);
    }
}

pub struct SessionExecutionControl {
    session: Arc<InteractiveExecutionSession>,
}

impl SessionExecutionControl {
    pub fn new(session: Arc<InteractiveExecutionSession>) -> Self {
        Self { session }
    }
}

#[async_trait]
impl ExecutionControl for SessionExecutionControl {
    fn plan_only(&self) -> bool {
        false
    }

    fn is_cancelled(&self) -> bool {
        self.session.cancellation.is_cancelled()
    }

    fn cancel_reason(&self) -> Option<String> {
        self.session.cancellation.cancel_reason()
    }

    fn on_event(&self, event: ExecutionEvent) {
        self.session.publish(event);
    }

    fn register_node(&self, node: ExecutionGraphNode) {
        self.session.register_node_internal(node);
    }

    fn update_node_status(
        &self,
        node_id: &str,
        status: ExecutionStatus,
        detail: Option<ExecutionStatusUpdateDetail>,
    ) {
        self.session
            .update_node_status_internal(node_id, status, detail);
    }

    fn get_quality_loop_decision(&self, node_id: &str) -> Option<QualityLoopManualDecision> {
        self.session
            .quality_loop_decisions
            .lock()
            .expect("quality_loop_decisions")
            .get(node_id)
            .cloned()
    }

    async fn wait_for_node_approval(&self, node: ExecutionGraphNode) -> NodeApprovalDecision {
        Arc::clone(&self.session)
            .wait_for_node_approval_internal(node)
            .await
    }
}
