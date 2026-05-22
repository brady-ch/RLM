use std::collections::HashMap;

use serde_json::Value;

use crate::application::execution::agent_registry::is_known_expert_agent;
use crate::domain::recursion::preview;
use crate::domain::types::{
    DeleteStrategy, ExecutionGraphEdge, ExecutionGraphNode, ExecutionStatus, ExpertRuntimeMode,
    GraphPosition,
};

use super::super::InteractiveExecutionSession;

impl InteractiveExecutionSession {
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
            return Err(super::mutation_format::mutation_err(
                "invalid_model",
                "Model override cannot be empty.",
                &[node_id],
            ));
        }
        let mut nodes = self.nodes.lock().expect("nodes");
        let node = nodes.get_mut(node_id).ok_or_else(|| {
            super::mutation_format::mutation_err(
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
            super::mutation_format::mutation_err(
                "unknown_node",
                &format!("Unknown node \"{node_id}\"."),
                &[node_id],
            )
        })?;
        if let Some(id) = agent_id {
            if !is_known_expert_agent(id) {
                return Err(super::mutation_format::mutation_err(
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
            return Err(super::mutation_format::mutation_err(
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
                super::mutation_format::mutation_err(
                    "invalid_parent",
                    &format!("Unknown parent node \"{parent_id}\"."),
                    &[parent_id],
                )
            })?;
        if parent.depth + 1 > 64 {
            return Err(super::mutation_format::mutation_err(
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
            r#loop: None,
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
            return Err(super::mutation_format::mutation_err(
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
            return Err(super::mutation_format::mutation_err(
                "delete_requires_choice",
                "Delete requires explicit choice for dependent nodes.",
                &[node_id],
            ));
        }
        if strategy == Some(DeleteStrategy::RewireDependents) {
            return self.rewire_and_delete_node(node_id);
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

    fn rewire_and_delete_node(&self, node_id: &str) -> Result<Vec<String>, String> {
        let dependents: Vec<_> = self
            .nodes
            .lock()
            .expect("nodes")
            .values()
            .filter(|n| n.parent_id.as_deref() == Some(node_id))
            .map(|n| n.id.clone())
            .collect();
        let parent_id = self
            .nodes
            .lock()
            .expect("nodes")
            .get(node_id)
            .and_then(|node| node.parent_id.clone())
            .ok_or_else(|| {
                super::mutation_format::mutation_err(
                    "rewire_requires_parent",
                    "Cannot rewire dependents when deleting a root node.",
                    &[node_id],
                )
            })?;
        let parent_depth = self
            .nodes
            .lock()
            .expect("nodes")
            .get(&parent_id)
            .map(|node| node.depth)
            .ok_or_else(|| {
                super::mutation_format::mutation_err(
                    "unknown_node",
                    &format!("Parent \"{parent_id}\" is missing for rewiring."),
                    &[node_id, &parent_id],
                )
            })?;
        for dependent_id in &dependents {
            {
                let mut nodes = self.nodes.lock().expect("nodes");
                if let Some(dependent) = nodes.get_mut(dependent_id) {
                    dependent.parent_id = Some(parent_id.clone());
                }
            }
            self.update_depths_from(dependent_id, parent_depth + 1);
            let edge = ExecutionGraphEdge {
                from: parent_id.clone(),
                to: dependent_id.clone(),
                source_handle: None,
                target_handle: None,
            };
            let mut edges = self.edges.lock().expect("edges");
            if !edges.iter().any(|e| e.from == edge.from && e.to == edge.to) {
                edges.push(edge);
            }
        }
        self.nodes.lock().expect("nodes").remove(node_id);
        self.pending.lock().expect("pending").remove(node_id);
        self.edges
            .lock()
            .expect("edges")
            .retain(|edge| edge.from != node_id && edge.to != node_id);
        Ok(vec![node_id.to_string()])
    }

    fn update_depths_from(&self, node_id: &str, depth: i32) {
        let child_ids: Vec<_> = self
            .nodes
            .lock()
            .expect("nodes")
            .values()
            .filter(|node| node.parent_id.as_deref() == Some(node_id))
            .map(|node| node.id.clone())
            .collect();
        if let Some(node) = self.nodes.lock().expect("nodes").get_mut(node_id) {
            node.depth = depth;
        }
        for child_id in child_ids {
            self.update_depths_from(&child_id, depth + 1);
        }
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
}
