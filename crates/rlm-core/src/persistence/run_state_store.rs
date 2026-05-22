use std::collections::HashMap;
use std::fs;
use std::io;
use std::path::PathBuf;

use serde::{Deserialize, Serialize};
use serde_json::Value;

use super::util::write_json_atomic;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RunStateNodeStatus {
    pub node_id: String,
    pub status: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RunStateMutationRecord {
    pub seq: u64,
    pub actor: String,
    pub path: String,
    pub action: String,
    pub accepted: bool,
    pub reason: String,
    pub timestamp: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RunStateSnapshot {
    pub run_id: String,
    pub version: u32,
    pub metadata: Value,
    pub node_statuses: Vec<RunStateNodeStatus>,
    pub artifact_refs: Value,
    pub checkpoints: Value,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub resume_cursor: Option<Value>,
    pub mutation_log: Vec<RunStateMutationRecord>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PersistedRunState {
    run_id: String,
    version: u32,
    metadata: Value,
    node_statuses: Vec<RunStateNodeStatus>,
    artifact_refs: Value,
    checkpoints: Value,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    resume_cursor: Option<Value>,
    mutation_log: Vec<RunStateMutationRecord>,
    acl_prefixes: Vec<String>,
    capability_tokens: HashMap<String, Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RunStateMutationRequest {
    pub actor: String,
    pub path: String,
    pub action: String,
    pub value: Value,
    pub expected_version: u32,
    pub capability_token: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RunStateMutationResult {
    pub accepted: bool,
    pub reason: String,
    pub next_version: u32,
    pub seq: u64,
}

pub struct FileRunStateStore {
    base_dir: PathBuf,
}

impl FileRunStateStore {
    pub fn new(base_dir: PathBuf) -> Self {
        Self { base_dir }
    }

    pub fn get_snapshot(&self, run_id: &str) -> io::Result<Option<RunStateSnapshot>> {
        Ok(self.read(run_id)?.map(|state| public_snapshot(&state)))
    }

    pub fn create_run(
        &self,
        run_id: &str,
        seed_metadata: Option<Value>,
    ) -> io::Result<RunStateSnapshot> {
        if let Some(existing) = self.read(run_id)? {
            return Ok(public_snapshot(&existing));
        }
        let state = PersistedRunState {
            run_id: run_id.to_string(),
            version: 1,
            metadata: seed_metadata.unwrap_or_else(|| Value::Object(Default::default())),
            node_statuses: Vec::new(),
            artifact_refs: Value::Object(Default::default()),
            checkpoints: Value::Array(Vec::new()),
            resume_cursor: None,
            mutation_log: Vec::new(),
            acl_prefixes: vec![
                "metadata".into(),
                "nodeStatuses".into(),
                "artifactRefs".into(),
                "checkpoints".into(),
                "resumeCursor".into(),
            ],
            capability_tokens: HashMap::new(),
        };
        self.write(run_id, &state)?;
        Ok(public_snapshot(&state))
    }

    pub fn mutate(
        &self,
        run_id: &str,
        request: RunStateMutationRequest,
    ) -> io::Result<RunStateMutationResult> {
        let mut state = self.read(run_id)?.ok_or_else(|| {
            io::Error::new(
                io::ErrorKind::NotFound,
                format!("Unknown run state: {run_id}"),
            )
        })?;

        if let Some(reason) = self.authorize(&state, &request) {
            return self.record_and_return(&mut state, run_id, &request, false, reason);
        }
        if request.expected_version != state.version {
            return self.record_and_return(
                &mut state,
                run_id,
                &request,
                false,
                "etag/version conflict".into(),
            );
        }

        apply_path_mutation(
            &mut state,
            &request.path,
            &request.action,
            request.value.clone(),
        )?;
        state.version += 1;
        self.record_and_return(&mut state, run_id, &request, true, "accepted".into())
    }

    pub fn list_mutations(&self, run_id: &str) -> io::Result<Vec<RunStateMutationRecord>> {
        Ok(self
            .read(run_id)?
            .map(|state| state.mutation_log)
            .unwrap_or_default())
    }

    fn authorize(
        &self,
        state: &PersistedRunState,
        request: &RunStateMutationRequest,
    ) -> Option<String> {
        let allowed_prefix = state.acl_prefixes.iter().any(|prefix| {
            request.path == *prefix || request.path.starts_with(&format!("{prefix}."))
        });
        if !allowed_prefix {
            return Some("path ACL denied".into());
        }
        if request.capability_token.is_none() {
            return Some("missing capability token".into());
        }
        let token = request.capability_token.as_deref().unwrap_or("");
        if token.is_empty() {
            return Some("missing capability token".into());
        }
        let allowed = state.capability_tokens.get(&request.actor)?;
        if !allowed.iter().any(|value| value == token) {
            return Some("capability token denied".into());
        }
        None
    }

    pub fn register_capability_token(
        &self,
        run_id: &str,
        actor: &str,
        token: &str,
    ) -> io::Result<()> {
        let mut state = self.read(run_id)?.ok_or_else(|| {
            io::Error::new(
                io::ErrorKind::NotFound,
                format!("Unknown run state: {run_id}"),
            )
        })?;
        let tokens = state
            .capability_tokens
            .entry(actor.to_string())
            .or_default();
        if !tokens.iter().any(|existing| existing == token) {
            tokens.push(token.to_string());
        }
        self.write(run_id, &state)
    }

    fn record_and_return(
        &self,
        state: &mut PersistedRunState,
        run_id: &str,
        request: &RunStateMutationRequest,
        accepted: bool,
        reason: String,
    ) -> io::Result<RunStateMutationResult> {
        let seq = state
            .mutation_log
            .last()
            .map(|entry| entry.seq)
            .unwrap_or(0)
            + 1;
        state.mutation_log.push(RunStateMutationRecord {
            seq,
            actor: request.actor.clone(),
            path: request.path.clone(),
            action: request.action.clone(),
            accepted,
            reason: reason.clone(),
            timestamp: iso_now(),
        });
        self.write(run_id, state)?;
        Ok(RunStateMutationResult {
            accepted,
            reason,
            next_version: state.version,
            seq,
        })
    }

    fn read(&self, run_id: &str) -> io::Result<Option<PersistedRunState>> {
        match fs::read_to_string(self.file_path(run_id)) {
            Ok(raw) => serde_json::from_str(&raw)
                .map(Some)
                .map_err(|err| io::Error::new(io::ErrorKind::InvalidData, err.to_string())),
            Err(err) if err.kind() == io::ErrorKind::NotFound => Ok(None),
            Err(err) => Err(err),
        }
    }

    fn write(&self, run_id: &str, state: &PersistedRunState) -> io::Result<()> {
        write_json_atomic(
            &self.file_path(run_id),
            &serde_json::to_value(state)
                .map_err(|err| io::Error::new(io::ErrorKind::InvalidData, err.to_string()))?,
        )
    }

    fn file_path(&self, run_id: &str) -> PathBuf {
        self.base_dir.join(format!("{run_id}.json"))
    }
}

fn public_snapshot(state: &PersistedRunState) -> RunStateSnapshot {
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

fn apply_path_mutation(
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

fn iso_now() -> String {
    time::OffsetDateTime::now_utc()
        .format(&time::format_description::well_known::Rfc3339)
        .unwrap_or_else(|_| "1970-01-01T00:00:00Z".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    use std::fs;

    fn temp_dir(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("rlm-runstate-{name}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn create_and_mutate_run_state() {
        let dir = temp_dir("mutate");
        let store = FileRunStateStore::new(dir);
        let created = store
            .create_run("run-1", Some(json!({ "source": "test" })))
            .unwrap();
        assert_eq!(created.run_id, "run-1");
        store
            .register_capability_token("run-1", "runtime", "run-1:runtime")
            .unwrap();
        let result = store
            .mutate(
                "run-1",
                RunStateMutationRequest {
                    actor: "runtime".into(),
                    path: "metadata.phase".into(),
                    action: "set".into(),
                    value: json!("planning"),
                    expected_version: 1,
                    capability_token: Some("run-1:runtime".into()),
                },
            )
            .unwrap();
        assert!(result.accepted);
        let snapshot = store.get_snapshot("run-1").unwrap().unwrap();
        assert_eq!(snapshot.metadata["phase"], "planning");
    }
}
