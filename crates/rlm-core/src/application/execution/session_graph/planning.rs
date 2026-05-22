use std::sync::Arc;

use crate::application::graph::planner::{plan_children, GraphPlannerContext};
use crate::domain::types::{
    ChatRunReadiness, ComposerPlanBudget, ExecutionGraphNode, ExecutionStatus, ExpertRuntimeMode,
    GraphPosition, PlanNodeResult, ReplanChoice,
};
use crate::ports::LanguageModel;

use super::super::InteractiveExecutionSession;

impl InteractiveExecutionSession {
    pub fn confirm_graph_and_run(&self) -> ChatRunReadiness {
        if self.is_confirmed_execution_running() {
            return ChatRunReadiness {
                state: "ready_to_run".into(),
                reason: "Execution is already running.".into(),
            };
        }
        if self.nodes.lock().expect("nodes").is_empty() {
            return ChatRunReadiness {
                state: "draft".into(),
                reason: "Draft graph: No graph nodes are available.".into(),
            };
        }
        if self
            .pending_mutation
            .lock()
            .expect("pending_mutation")
            .is_some()
        {
            return ChatRunReadiness {
                state: "draft".into(),
                reason: "Draft graph: Resolve the pending mutation preview first.".into(),
            };
        }
        ChatRunReadiness {
            state: "ready_to_run".into(),
            reason: "Graph confirmed. Run can start.".into(),
        }
    }
    pub fn abort_run_from_clarification(&self, question_id: &str) -> Result<(), String> {
        let pending = self.pending_clarification.lock().expect("clarify").clone();
        let Some(pending) = pending else {
            return Err(super::mutation_format::mutation_err(
                "unknown_question",
                "Unknown or resolved clarification question.",
                &[],
            ));
        };
        if pending.question_id != question_id {
            return Err(super::mutation_format::mutation_err(
                "unknown_question",
                "Unknown or resolved clarification question.",
                &[],
            ));
        }
        self.stop("aborted at clarification checkpoint");
        Ok(())
    }

    pub fn default_plan_budget(depth: i32) -> ComposerPlanBudget {
        ComposerPlanBudget {
            max_depth: 3,
            max_nodes: 12,
            used_depth: depth,
            used_nodes: 1,
            remaining_depth: (3 - depth).max(0),
            remaining_nodes: 11,
            exhausted: false,
            approval_required: None,
        }
    }

    pub async fn plan_node(
        &self,
        node_id: &str,
        replan: Option<ReplanChoice>,
        plan_model: Arc<dyn LanguageModel>,
    ) -> Result<PlanNodeResult, String> {
        let node = self
            .nodes
            .lock()
            .expect("nodes")
            .get(node_id)
            .cloned()
            .ok_or_else(|| format!("Unknown node \"{node_id}\"."))?;
        let normalized = node
            .prompt
            .clone()
            .unwrap_or(node.label.clone())
            .trim()
            .to_string();
        if normalized.is_empty() {
            return Err(super::mutation_format::mutation_err(
                "invalid_prompt",
                "Node prompt cannot be empty.",
                &[node_id],
            ));
        }
        if replan == Some(ReplanChoice::Cancel) {
            let budget = Self::default_plan_budget(node.depth);
            return Ok(PlanNodeResult {
                planned_node_ids: vec![],
                budget: budget.clone(),
                exhausted: budget.exhausted,
            });
        }
        let budget = Self::default_plan_budget(node.depth);
        let remaining_nodes = budget.remaining_nodes.max(1);
        let context = GraphPlannerContext {
            node_id: node_id.to_string(),
            node_label: node.label.clone(),
            node_prompt: normalized,
            ancestors: vec![],
            protected_descendants: vec![],
            max_children: remaining_nodes,
        };
        let children = plan_children(plan_model, context).await?;
        let mut created = Vec::new();
        let base_x = node
            .position
            .as_ref()
            .map(|p| p.x)
            .unwrap_or(node.depth as f64 * 430.0)
            + 430.0;
        let base_y = node.position.as_ref().map(|p| p.y).unwrap_or(0.0);
        for (index, spec) in children.iter().enumerate() {
            let id = format!(
                "task-planned-{}",
                self.nodes.lock().expect("nodes").len() + index + 1
            );
            let runtime = spec.runtime.unwrap_or(if spec.complexity == "high" {
                ExpertRuntimeMode::Rlm
            } else {
                ExpertRuntimeMode::SinglePass
            });
            let child = ExecutionGraphNode {
                id: id.clone(),
                parent_id: Some(node_id.to_string()),
                kind: "task".into(),
                label: spec.label.clone(),
                prompt: Some(spec.prompt.clone()),
                original_prompt: Some(spec.prompt.clone()),
                depth: node.depth + 1,
                status: ExecutionStatus::Planned,
                approval_token: None,
                model_override: None,
                approval_source: None,
                approval_reason: None,
                spawned_after_initial_approval: Some(true),
                position: Some(GraphPosition {
                    x: base_x,
                    y: base_y + index as f64 * 220.0,
                }),
                expert_agent_id: spec.agent_id.clone().or(Some("default".into())),
                expert_assignment_mode: Some("planner".into()),
                expert_runtime: Some(runtime),
                expert_tool_allowlist: spec.tool_allowlist.clone(),
                expert_purpose_tiers: spec.purpose_tiers.clone(),
                sampling_override: None,
                composer: None,
                editable_fields: Some(vec!["prompt".into()]),
                r#loop: None,
            };
            self.register_node_internal(child);
            created.push(id);
        }
        let next_budget = ComposerPlanBudget {
            used_nodes: budget.used_nodes + created.len() as i32,
            remaining_nodes: (budget.remaining_nodes - created.len() as i32).max(0),
            ..budget
        };
        Ok(PlanNodeResult {
            planned_node_ids: created,
            budget: next_budget,
            exhausted: false,
        })
    }

    pub fn extend_plan_budget(
        &self,
        node_id: &str,
        max_depth: Option<i32>,
        max_nodes: Option<i32>,
    ) -> Result<ComposerPlanBudget, String> {
        if !self.nodes.lock().expect("nodes").contains_key(node_id) {
            return Err(format!("Unknown node \"{node_id}\"."));
        }
        let current = Self::default_plan_budget(0);
        Ok(ComposerPlanBudget {
            max_depth: max_depth.unwrap_or(current.max_depth + 1),
            max_nodes: max_nodes.unwrap_or(current.max_nodes + 4),
            exhausted: false,
            approval_required: Some(true),
            ..current
        })
    }

    pub fn accept_quality_loop(&self, node_id: &str, reason: Option<&str>) -> Result<(), String> {
        if !self.nodes.lock().expect("nodes").contains_key(node_id) {
            return Err(format!("Unknown node \"{node_id}\"."));
        }
        self.set_quality_loop_decision(
            node_id,
            "accept",
            reason.unwrap_or("quality loop manually accepted"),
        );
        Ok(())
    }

    pub fn stop_quality_loop(&self, node_id: &str, reason: Option<&str>) -> Result<(), String> {
        if !self.nodes.lock().expect("nodes").contains_key(node_id) {
            return Err(format!("Unknown node \"{node_id}\"."));
        }
        self.set_quality_loop_decision(
            node_id,
            "stop",
            reason.unwrap_or("quality loop manually stopped"),
        );
        Ok(())
    }
}
