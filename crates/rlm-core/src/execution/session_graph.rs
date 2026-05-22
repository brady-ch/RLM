use std::collections::HashMap;
use std::sync::Arc;

use serde_json::Value;

use crate::domain::recursion::preview;
use crate::domain::types::{
    ChatRunReadiness, ComposerPlanBudget, DeleteStrategy, ExecutionGraphEdge, ExecutionGraphNode,
    ExecutionStatus, ExpertRuntimeMode, GraphMutationError, GraphPosition, GraphViewport,
    PlanNodeResult, ReplanChoice, SessionSnapshot,
};
use crate::execution::agent_registry::is_known_expert_agent;
use crate::graph::planner::{plan_children, GraphPlannerContext};
use crate::ports::LanguageModel;

use super::InteractiveExecutionSession;

impl InteractiveExecutionSession {
    pub fn to_mutation_error(&self, err: &str) -> Option<GraphMutationError> {
        if err.starts_with("MUTATION:") {
            let parts: Vec<_> = err.splitn(6, '|').collect();
            if parts.len() >= 3 {
                return Some(GraphMutationError {
                    code: parts[1].to_string(),
                    error: parts[2].to_string(),
                    node_ids: parts
                        .get(3)
                        .map(|s| s.split(',').map(String::from).collect())
                        .unwrap_or_default(),
                    details: parts
                        .get(4)
                        .and_then(|s| (!s.is_empty()).then(|| (*s).to_string())),
                    suggested_fix: parts
                        .get(5)
                        .and_then(|s| (!s.is_empty()).then(|| (*s).to_string())),
                });
            }
        }
        None
    }

    fn mutation_err(code: &str, message: &str, node_ids: &[&str]) -> String {
        format!("MUTATION:{code}|{message}|{}||", node_ids.join(","))
    }

    pub fn restore_snapshot(&self, snapshot: SessionSnapshot) {
        {
            let mut nodes = self.nodes.lock().expect("nodes");
            nodes.clear();
            for node in snapshot.graph.nodes {
                nodes.insert(node.id.clone(), node);
            }
        }
        *self.edges.lock().expect("edges") = snapshot.graph.edges;
        if let Some(vp) = snapshot.graph.viewport {
            *self.viewport.lock().expect("viewport") = vp;
        }
    }

    pub fn update_graph_layout(&self, positions: HashMap<String, GraphPosition>) {
        let mut nodes = self.nodes.lock().expect("nodes");
        for (id, pos) in positions {
            if let Some(node) = nodes.get_mut(&id) {
                node.position = Some(pos);
            }
        }
        drop(nodes);
        self.publish(crate::domain::types::ExecutionEvent::execution(
            ExecutionStatus::Planned,
        ));
    }

    pub fn set_graph_viewport(&self, viewport: GraphViewport) {
        let zoom = if viewport.zoom.is_finite() && viewport.zoom > 0.0 {
            viewport.zoom
        } else {
            1.0
        };
        *self.viewport.lock().expect("viewport") = GraphViewport {
            x: if viewport.x.is_finite() {
                viewport.x
            } else {
                0.0
            },
            y: if viewport.y.is_finite() {
                viewport.y
            } else {
                0.0
            },
            zoom,
        };
        self.publish(crate::domain::types::ExecutionEvent::execution(
            ExecutionStatus::Planned,
        ));
    }

    pub fn edit_node_prompt(&self, node_id: &str, prompt: &str) -> Result<(), String> {
        let normalized = prompt.trim();
        if normalized.is_empty() {
            return Err("Node prompt cannot be empty.".into());
        }
        let mut nodes = self.nodes.lock().expect("nodes");
        let node = nodes
            .get_mut(node_id)
            .ok_or_else(|| format!("Unknown node \"{node_id}\"."))?;
        node.prompt = Some(normalized.to_string());
        node.label = preview(normalized, 80);
        Ok(())
    }

    pub fn set_node_model_override(&self, node_id: &str, model: &str) -> Result<(), String> {
        let normalized = model.trim();
        if normalized.is_empty() {
            return Err(Self::mutation_err(
                "invalid_model",
                "Model override cannot be empty.",
                &[node_id],
            ));
        }
        let mut nodes = self.nodes.lock().expect("nodes");
        let node = nodes.get_mut(node_id).ok_or_else(|| {
            Self::mutation_err(
                "unknown_node",
                &format!("Unknown node \"{node_id}\"."),
                &[node_id],
            )
        })?;
        node.model_override = Some(normalized.to_string());
        Ok(())
    }

    pub fn set_node_sampling_override(&self, node_id: &str, sampling: Value) -> Result<(), String> {
        let mut nodes = self.nodes.lock().expect("nodes");
        let node = nodes
            .get_mut(node_id)
            .ok_or_else(|| format!("Unknown node \"{node_id}\"."))?;
        if sampling.as_object().is_some_and(|o| o.is_empty()) {
            node.sampling_override = None;
        } else {
            node.sampling_override = Some(serde_json::from_value(sampling).unwrap_or_default());
        }
        Ok(())
    }

    pub fn set_node_expert_override(
        &self,
        node_id: &str,
        agent_id: Option<&str>,
        runtime: Option<ExpertRuntimeMode>,
        tool_allowlist: Option<Vec<String>>,
        purpose_tiers: Option<HashMap<String, String>>,
    ) -> Result<(), String> {
        let mut nodes = self.nodes.lock().expect("nodes");
        let node = nodes.get_mut(node_id).ok_or_else(|| {
            Self::mutation_err(
                "unknown_node",
                &format!("Unknown node \"{node_id}\"."),
                &[node_id],
            )
        })?;
        if let Some(id) = agent_id {
            if !is_known_expert_agent(id) {
                return Err(Self::mutation_err(
                    "invalid_expert",
                    &format!("Unknown expert preset \"{id}\"."),
                    &[node_id],
                ));
            }
            node.expert_agent_id = Some(id.trim().to_string());
        }
        if let Some(rt) = runtime {
            node.expert_runtime = Some(rt);
        }
        if let Some(list) = tool_allowlist {
            node.expert_tool_allowlist = Some(
                list.into_iter()
                    .map(|t| t.trim().to_string())
                    .filter(|t| !t.is_empty())
                    .collect(),
            );
        }
        if let Some(tiers) = purpose_tiers {
            node.expert_purpose_tiers = Some(tiers);
        }
        node.expert_assignment_mode = Some("custom".into());
        Ok(())
    }

    pub fn add_node(
        &self,
        parent_id: &str,
        prompt: &str,
        kind: &str,
    ) -> Result<ExecutionGraphNode, String> {
        let normalized = prompt.trim();
        if normalized.is_empty() {
            return Err(Self::mutation_err(
                "invalid_prompt",
                "Node prompt cannot be empty.",
                &[parent_id],
            ));
        }
        let parent = self
            .nodes
            .lock()
            .expect("nodes")
            .get(parent_id)
            .cloned()
            .ok_or_else(|| {
                Self::mutation_err(
                    "invalid_parent",
                    &format!("Unknown parent node \"{parent_id}\"."),
                    &[parent_id],
                )
            })?;
        if parent.depth + 1 > 64 {
            return Err(Self::mutation_err(
                "max_depth_exceeded",
                "Node depth exceeds configured max depth guardrail.",
                &[parent_id],
            ));
        }
        let sibling_count = self
            .nodes
            .lock()
            .expect("nodes")
            .values()
            .filter(|n| n.parent_id.as_deref() == Some(parent_id))
            .count();
        let id = format!(
            "task-manual-{}",
            self.nodes.lock().expect("nodes").len() + 1
        );
        let px = parent
            .position
            .as_ref()
            .map(|p| p.x)
            .unwrap_or(parent.depth as f64 * 430.0);
        let py = parent.position.as_ref().map(|p| p.y).unwrap_or(0.0);
        let node = ExecutionGraphNode {
            id: id.clone(),
            parent_id: Some(parent_id.to_string()),
            kind: kind.to_string(),
            label: preview(normalized, 80),
            prompt: Some(normalized.to_string()),
            original_prompt: Some(normalized.to_string()),
            depth: parent.depth + 1,
            status: ExecutionStatus::Ready,
            approval_token: None,
            model_override: None,
            approval_source: None,
            approval_reason: None,
            spawned_after_initial_approval: None,
            position: Some(GraphPosition {
                x: px + 430.0,
                y: py + sibling_count as f64 * 220.0,
            }),
            expert_agent_id: None,
            expert_assignment_mode: None,
            expert_runtime: None,
            expert_tool_allowlist: None,
            expert_purpose_tiers: None,
            sampling_override: None,
            composer: None,
            editable_fields: Some(vec!["prompt".into()]),
        };
        self.register_node_internal(node.clone());
        Ok(node)
    }

    pub fn connect_node(
        &self,
        node_id: &str,
        parent_id: &str,
        source_handle: Option<String>,
        target_handle: Option<String>,
    ) -> Result<(), String> {
        if !self.nodes.lock().expect("nodes").contains_key(node_id) {
            return Err(format!("Unknown node \"{node_id}\"."));
        }
        if !self.nodes.lock().expect("nodes").contains_key(parent_id) {
            return Err(format!("Unknown parent node \"{parent_id}\"."));
        }
        {
            let mut nodes = self.nodes.lock().expect("nodes");
            if let Some(node) = nodes.get_mut(node_id) {
                node.parent_id = Some(parent_id.to_string());
            }
        }
        let edge = ExecutionGraphEdge {
            from: parent_id.to_string(),
            to: node_id.to_string(),
            source_handle,
            target_handle,
        };
        let mut edges = self.edges.lock().expect("edges");
        if !edges.iter().any(|e| e.from == edge.from && e.to == edge.to) {
            edges.push(edge);
        }
        Ok(())
    }

    pub fn delete_node_with_strategy(
        &self,
        node_id: &str,
        strategy: Option<DeleteStrategy>,
    ) -> Result<Vec<String>, String> {
        if !self.nodes.lock().expect("nodes").contains_key(node_id) {
            return Err(Self::mutation_err(
                "unknown_node",
                &format!("Unknown node \"{node_id}\"."),
                &[node_id],
            ));
        }
        let dependents: Vec<_> = self
            .nodes
            .lock()
            .expect("nodes")
            .values()
            .filter(|n| n.parent_id.as_deref() == Some(node_id))
            .map(|n| n.id.clone())
            .collect();
        if !dependents.is_empty() && strategy.is_none() {
            return Err(Self::mutation_err(
                "delete_requires_choice",
                "Delete requires explicit choice for dependent nodes.",
                &[node_id],
            ));
        }
        let deleted = self.collect_descendants(node_id);
        for id in &deleted {
            self.nodes.lock().expect("nodes").remove(id);
            self.pending.lock().expect("pending").remove(id);
        }
        self.edges
            .lock()
            .expect("edges")
            .retain(|e| !deleted.contains(&e.from) && !deleted.contains(&e.to));
        Ok(deleted)
    }

    fn collect_descendants(&self, root_id: &str) -> Vec<String> {
        let nodes = self.nodes.lock().expect("nodes");
        let mut out = vec![root_id.to_string()];
        let mut i = 0;
        while i < out.len() {
            let current = out[i].clone();
            for node in nodes.values() {
                if node.parent_id.as_deref() == Some(current.as_str()) && !out.contains(&node.id) {
                    out.push(node.id.clone());
                }
            }
            i += 1;
        }
        out
    }

    pub fn skip_node(&self, node_id: &str, token: Option<&str>) -> Result<bool, String> {
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
            .insert(wait.token);
        if let Some(node) = self.nodes.lock().expect("nodes").get_mut(node_id) {
            node.status = ExecutionStatus::Skipped;
            node.approval_token = None;
        }
        let prompt = self
            .nodes
            .lock()
            .expect("nodes")
            .get(node_id)
            .and_then(|n| n.prompt.clone())
            .unwrap_or_default();
        let _ = wait
            .sender
            .send(crate::domain::types::NodeApprovalDecision {
                status: crate::domain::types::NodeApprovalStatus::Skipped,
                prompt,
                model_override: None,
            });
        Ok(false)
    }

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
        ChatRunReadiness {
            state: "ready_to_run".into(),
            reason: "Graph confirmed. Run can start.".into(),
        }
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
            return Err(Self::mutation_err(
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

    pub fn accept_quality_loop(&self, node_id: &str, _reason: Option<&str>) -> Result<(), String> {
        if !self.nodes.lock().expect("nodes").contains_key(node_id) {
            return Err(format!("Unknown node \"{node_id}\"."));
        }
        Ok(())
    }

    pub fn stop_quality_loop(&self, node_id: &str, _reason: Option<&str>) -> Result<(), String> {
        if !self.nodes.lock().expect("nodes").contains_key(node_id) {
            return Err(format!("Unknown node \"{node_id}\"."));
        }
        Ok(())
    }

    pub fn patch_graph_workflow_metadata(
        &self,
        linked_workflow_id: Option<String>,
        last_variant: Option<String>,
        exported_at: Option<String>,
    ) {
        *self.graph_workflow_metadata.lock().expect("meta") =
            Some(crate::domain::types::GraphWorkflowMetadata {
                linked_workflow_id,
                last_variant,
                exported_at,
            });
    }
}
