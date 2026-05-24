use std::io;

use serde_json::Value;

use crate::ports::{RunStateNodeStatus, RunStateSnapshot};

use super::PersistedRunState;

pub(super) fn public_snapshot(state: &PersistedRunState) -> RunStateSnapshot {
    RunStateSnapshot {
        run_id: state.run_id.clone(),
        version: state.version,
        metadata: state.metadata.clone(),
        node_statuses: state.node_statuses.clone(),
        artifact_refs: state.artifact_refs.clone(),
        checkpoints: state.checkpoints.clone(),
        resume_cursor: state.resume_cursor.clone(),
        mutation_log: state.mutation_log.clone(),
    }
}

pub(super) fn apply_path_mutation(
    state: &mut PersistedRunState,
    path: &str,
    action: &str,
    value: Value,
) -> io::Result<()> {
    let parts: Vec<&str> = path.split('.').filter(|part| !part.is_empty()).collect();
    if parts.is_empty() {
        return Err(io::Error::new(
            io::ErrorKind::InvalidInput,
            "Mutation path cannot be empty.",
        ));
    }

    let root = parts[0];
    let tail = &parts[1..];

    if root == "nodeStatuses" && tail.len() == 1 {
        let node_id = tail[0];
        let index = state
            .node_statuses
            .iter()
            .position(|item| item.node_id == node_id);
        if action == "delete" {
            if let Some(index) = index {
                state.node_statuses.remove(index);
            }
            return Ok(());
        }
        let record = value.as_object().ok_or_else(|| {
            io::Error::new(
                io::ErrorKind::InvalidInput,
                "Node status mutation requires an object value.",
            )
        })?;
        let next = RunStateNodeStatus {
            node_id: node_id.to_string(),
            status: record
                .get("status")
                .and_then(Value::as_str)
                .unwrap_or("")
                .to_string(),
            updated_at: record
                .get("updatedAt")
                .and_then(Value::as_str)
                .unwrap_or("1970-01-01T00:00:00Z")
                .to_string(),
        };
        if let Some(index) = index {
            state.node_statuses[index] = next;
        } else {
            state.node_statuses.push(next);
        }
        return Ok(());
    }

    if tail.is_empty() {
        let root_value = match root {
            "metadata" => &mut state.metadata,
            "artifactRefs" => &mut state.artifact_refs,
            "checkpoints" => &mut state.checkpoints,
            "resumeCursor" => {
                if action == "delete" {
                    state.resume_cursor = None;
                } else {
                    state.resume_cursor = Some(value);
                }
                return Ok(());
            }
            _ => {
                return Err(io::Error::new(
                    io::ErrorKind::InvalidInput,
                    format!("Cannot mutate non-object path root: {root}"),
                ));
            }
        };
        if action == "delete" {
            *root_value = Value::Null;
        } else {
            *root_value = value;
        }
        return Ok(());
    }

    let target = match root {
        "metadata" => &mut state.metadata,
        "artifactRefs" => &mut state.artifact_refs,
        "checkpoints" => &mut state.checkpoints,
        _ => {
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                format!("Cannot mutate non-object path root: {root}"),
            ));
        }
    };

    mutate_object_path(target, tail, action, value)
}

fn mutate_object_path(
    root: &mut Value,
    tail: &[&str],
    action: &str,
    value: Value,
) -> io::Result<()> {
    let mut current = root;
    for (index, part) in tail.iter().enumerate() {
        if !current.is_object() {
            *current = Value::Object(Default::default());
        }
        let object = current.as_object_mut().ok_or_else(|| {
            io::Error::new(
                io::ErrorKind::InvalidInput,
                "Cannot mutate non-object path segment.",
            )
        })?;
        if index == tail.len() - 1 {
            if action == "delete" {
                object.remove(*part);
            } else {
                object.insert((*part).to_string(), value);
            }
            return Ok(());
        }
        if !object.get(*part).map(Value::is_object).unwrap_or(false) {
            object.insert((*part).to_string(), Value::Object(Default::default()));
        }
        current = object.get_mut(*part).ok_or_else(|| {
            io::Error::new(
                io::ErrorKind::InvalidInput,
                "Invalid mutation path segment.",
            )
        })?;
    }
    Ok(())
}

pub(super) fn iso_now() -> String {
    time::OffsetDateTime::now_utc()
        .format(&time::format_description::well_known::Rfc3339)
        .unwrap_or_else(|_| "1970-01-01T00:00:00Z".to_string())
}
