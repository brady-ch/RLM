use serde_json::{json, Value};

use crate::domain::types::{DeleteStrategy, GraphMutationError};

use super::super::session::{PendingChatMutation, PendingMutationKind};
use super::super::InteractiveExecutionSession;

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

    fn resolve_node_target(&self, target: &str, action: &str) -> Result<String, String> {
        let normalized = target.trim().to_lowercase();
        let matches: Vec<_> = self
            .nodes
            .lock()
            .expect("nodes")
            .values()
            .filter(|node| {
                node.id.to_lowercase() == normalized
                    || node.label.to_lowercase().contains(&normalized)
            })
            .cloned()
            .collect();
        if matches.is_empty() {
            return Err(super::mutation_format::mutation_err(
                "unknown_node",
                &format!("No node matches \"{target}\"."),
                &[],
            ));
        }
        if matches.len() > 1 {
            return Err(super::mutation_format::mutation_err(
                "ambiguous_node_target",
                &format!("Ambiguous {action} target \"{target}\"."),
                &matches
                    .iter()
                    .map(|node| node.id.as_str())
                    .collect::<Vec<_>>(),
            ));
        }
        Ok(matches[0].id.clone())
    }

    fn set_pending_mutation(
        &self,
        mutation: PendingMutationKind,
        summary: &str,
        overrides: Value,
    ) -> Value {
        let mut version = self.mutation_version.lock().expect("mutation_version");
        *version += 1;
        let id = format!("mutation-{version}");
        let mut proposal = json!({
            "id": id,
            "summary": summary,
            "requiresClarification": false,
            "requiresDeleteChoice": false,
        });
        if let (Some(base), Some(extra)) = (proposal.as_object_mut(), overrides.as_object()) {
            for (key, value) in extra {
                base.insert(key.clone(), value.clone());
            }
        }
        let pending = PendingChatMutation {
            id: id.clone(),
            mutation,
            proposal: proposal.clone(),
        };
        *self.pending_mutation.lock().expect("pending_mutation") = Some(pending);
        proposal
    }

    pub fn preview_mutation_from_chat(&self, message: &str) -> Result<Value, String> {
        let normalized = message.trim();
        if normalized.is_empty() {
            return Err(super::mutation_format::mutation_err(
                "invalid_prompt",
                "Chat message cannot be empty.",
                &[],
            ));
        }
        let lower = normalized.to_lowercase();
        if lower.starts_with("edit ") {
            let parsed = normalized.replacen("edit ", "", 1);
            let Some((target, prompt)) = parsed.split_once(':') else {
                return Err(super::mutation_format::mutation_err(
                    "invalid_prompt",
                    "Edit format must be: edit <node> : <new prompt>.",
                    &[],
                ));
            };
            let node_id = self.resolve_node_target(target.trim(), "edit")?;
            let prompt = prompt.trim();
            if prompt.is_empty() {
                return Err(super::mutation_format::mutation_err(
                    "invalid_prompt",
                    "Edited prompt cannot be empty.",
                    &[&node_id],
                ));
            }
            return Ok(self.set_pending_mutation(
                PendingMutationKind::Edit {
                    node_id: node_id.clone(),
                    prompt: prompt.to_string(),
                },
                &format!("Edit {node_id} prompt"),
                json!({}),
            ));
        }
        if lower.starts_with("delete ") {
            let target = normalized
                .strip_prefix("delete ")
                .or_else(|| normalized.strip_prefix("DELETE "))
                .unwrap_or("")
                .trim();
            let node_id = self.resolve_node_target(target, "delete")?;
            let dependents: Vec<_> = self
                .nodes
                .lock()
                .expect("nodes")
                .values()
                .filter(|node| node.parent_id.as_deref() == Some(node_id.as_str()))
                .cloned()
                .collect();
            if !dependents.is_empty() {
                return Ok(self.set_pending_mutation(
                    PendingMutationKind::Delete {
                        node_id: node_id.clone(),
                        strategy: None,
                    },
                    &format!("Delete {node_id} requires dependency choice"),
                    json!({
                        "requiresDeleteChoice": true,
                        "pendingDeleteChoice": {
                            "nodeId": node_id,
                            "options": ["delete_subtree", "rewire_dependents"]
                        }
                    }),
                ));
            }
            return Ok(self.set_pending_mutation(
                PendingMutationKind::Delete {
                    node_id: node_id.clone(),
                    strategy: Some(DeleteStrategy::DeleteSubtree),
                },
                &format!("Delete subtree for {node_id}"),
                json!({}),
            ));
        }
        Err(super::mutation_format::mutation_err(
            "unsupported_mutation",
            "Unsupported chat mutation command.",
            &[],
        ))
    }

    pub fn apply_pending_mutation(
        &self,
        proposal_id: Option<&str>,
        delete_strategy: Option<DeleteStrategy>,
    ) -> Result<Value, String> {
        let mut pending_guard = self.pending_mutation.lock().expect("pending_mutation");
        let Some(pending) = pending_guard.clone() else {
            return Err(super::mutation_format::mutation_err(
                "missing_pending_mutation",
                "No pending mutation to apply.",
                &[],
            ));
        };
        if let Some(proposal_id) = proposal_id {
            if proposal_id != pending.id {
                return Err(super::mutation_format::mutation_err(
                    "stale_mutation",
                    "Pending mutation id does not match.",
                    &[],
                ));
            }
        }
        let mut summary = pending
            .proposal
            .get("summary")
            .and_then(|value: &serde_json::Value| value.as_str())
            .unwrap_or("Applied mutation.")
            .to_string();
        let mut deleted_node_ids = None;
        match pending.mutation {
            PendingMutationKind::Edit { node_id, prompt } => {
                self.edit_node_prompt(&node_id, &prompt)?;
            }
            PendingMutationKind::Delete { node_id, strategy } => {
                let strategy = delete_strategy.or(strategy);
                let deleted = self.delete_node_with_strategy(&node_id, strategy)?;
                deleted_node_ids = Some(deleted.clone());
                summary = format!(
                    "Deleted {} node(s) using {}",
                    deleted.len(),
                    match strategy {
                        Some(DeleteStrategy::RewireDependents) => "rewire_dependents",
                        _ => "delete_subtree",
                    }
                );
            }
        }
        *pending_guard = None;
        Ok(json!({
            "applied": true,
            "summary": summary,
            "deletedNodeIds": deleted_node_ids,
        }))
    }

    pub fn clear_pending_mutation(&self) {
        *self.pending_mutation.lock().expect("pending_mutation") = None;
    }
}
