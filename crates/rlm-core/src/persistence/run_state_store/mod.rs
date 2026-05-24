mod mutation;
mod persist;

use std::collections::HashMap;
use std::io;
use std::path::PathBuf;

use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::ports::RunStateStorePort;

pub use crate::ports::{
    RunStateMutationRecord, RunStateMutationRequest, RunStateMutationResult, RunStateNodeStatus,
    RunStateSnapshot,
};

use mutation::{apply_path_mutation, iso_now, public_snapshot};

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
}

impl RunStateStorePort for FileRunStateStore {
    fn get_snapshot(&self, run_id: &str) -> io::Result<Option<RunStateSnapshot>> {
        FileRunStateStore::get_snapshot(self, run_id)
    }

    fn create_run(
        &self,
        run_id: &str,
        seed_metadata: Option<Value>,
    ) -> io::Result<RunStateSnapshot> {
        FileRunStateStore::create_run(self, run_id, seed_metadata)
    }

    fn mutate(
        &self,
        run_id: &str,
        request: RunStateMutationRequest,
    ) -> io::Result<RunStateMutationResult> {
        FileRunStateStore::mutate(self, run_id, request)
    }

    fn register_capability_token(&self, run_id: &str, actor: &str, token: &str) -> io::Result<()> {
        FileRunStateStore::register_capability_token(self, run_id, actor, token)
    }
}

#[cfg(test)]
#[path = "../../../tests/persistence/run_state_store.rs"]
mod run_state_store_tests;
