use std::sync::Arc;

use serde_json::json;

use super::run_state_types::ResumeCursor;
use crate::persistence::run_state_store::{
    FileRunStateStore, RunStateMutationRequest, RunStateSnapshot,
};

pub struct RunStatePersistence {
    run_id: String,
    store: Arc<FileRunStateStore>,
    actor: String,
    capability_token: String,
}

impl RunStatePersistence {
    pub fn new(run_id: impl Into<String>, store: Arc<FileRunStateStore>) -> Self {
        let run_id = run_id.into();
        Self {
            capability_token: format!("cap-{run_id}"),
            run_id,
            store,
            actor: "graph-executor".into(),
        }
    }

    pub fn run_id(&self) -> &str {
        &self.run_id
    }

    pub fn initialize(&self, prompt: &str, agent_id: &str) -> std::io::Result<RunStateSnapshot> {
        let snapshot = self.store.create_run(
            &self.run_id,
            Some(json!({
                "prompt": prompt,
                "agent": agent_id,
            })),
        )?;
        self.store
            .register_capability_token(&self.run_id, &self.actor, &self.capability_token)?;
        Ok(snapshot)
    }

    pub fn persist_node_status(&self, node_id: &str, status: &str) -> std::io::Result<()> {
        let updated_at = time::OffsetDateTime::now_utc()
            .format(&time::format_description::well_known::Rfc3339)
            .unwrap_or_else(|_| "1970-01-01T00:00:00Z".to_string());
        for attempt in 0..3 {
            let Some(snapshot) = self.store.get_snapshot(&self.run_id)? else {
                return Ok(());
            };
            let result = self.store.mutate(
                &self.run_id,
                RunStateMutationRequest {
                    actor: self.actor.clone(),
                    path: format!("nodeStatuses.{node_id}"),
                    action: "set".into(),
                    value: json!({
                        "nodeId": node_id,
                        "status": status,
                        "updatedAt": updated_at,
                    }),
                    expected_version: snapshot.version,
                    capability_token: Some(self.capability_token.clone()),
                },
            )?;
            if result.accepted {
                return Ok(());
            }
            if result.reason != "etag/version conflict" || attempt == 2 {
                return Err(std::io::Error::other(format!(
                    "run state mutation rejected: {}",
                    result.reason
                )));
            }
        }
        Ok(())
    }

    pub fn persist_resume_cursor(&self, cursor: &ResumeCursor) -> std::io::Result<()> {
        let value = serde_json::to_value(cursor).map_err(std::io::Error::other)?;
        for attempt in 0..3 {
            let Some(snapshot) = self.store.get_snapshot(&self.run_id)? else {
                return Ok(());
            };
            let result = self.store.mutate(
                &self.run_id,
                RunStateMutationRequest {
                    actor: self.actor.clone(),
                    path: "resumeCursor".into(),
                    action: "set".into(),
                    value: value.clone(),
                    expected_version: snapshot.version,
                    capability_token: Some(self.capability_token.clone()),
                },
            )?;
            if result.accepted {
                return Ok(());
            }
            if result.reason != "etag/version conflict" || attempt == 2 {
                return Err(std::io::Error::other(format!(
                    "run state mutation rejected: {}",
                    result.reason
                )));
            }
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    fn temp_dir(name: &str) -> std::path::PathBuf {
        let dir = std::env::temp_dir().join(format!("rlm-run-state-{name}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn run_state_persistence_seeds_snapshot_and_mutates_node_status() {
        let dir = temp_dir("persist");
        let store = Arc::new(FileRunStateStore::new(dir));
        let persistence = RunStatePersistence::new("run-test", Arc::clone(&store));
        persistence
            .initialize("hello", "default")
            .expect("initialize");
        persistence
            .persist_node_status("root-composer", "running")
            .expect("persist running");
        persistence
            .persist_node_status("root-composer", "completed")
            .expect("persist completed");

        let snapshot = store
            .get_snapshot("run-test")
            .expect("get")
            .expect("exists");
        assert!(!snapshot.mutation_log.is_empty());
        assert!(snapshot
            .node_statuses
            .iter()
            .any(|entry| entry.node_id == "root-composer" && entry.status == "completed"));
    }

    #[test]
    fn persist_resume_cursor_writes_cursor_path() {
        let dir = temp_dir("cursor");
        let store = Arc::new(FileRunStateStore::new(dir));
        let persistence = RunStatePersistence::new("run-cursor", Arc::clone(&store));
        persistence
            .initialize("hello", "default")
            .expect("initialize");
        persistence
            .persist_resume_cursor(&super::super::run_state_types::ResumeCursor {
                active_node_id: "node-1".into(),
                completed_node_ids: vec!["root".into()],
                variant: "playbook".into(),
            })
            .expect("persist cursor");

        let snapshot = store
            .get_snapshot("run-cursor")
            .expect("get")
            .expect("exists");
        let cursor = snapshot.resume_cursor.expect("resume cursor");
        assert_eq!(
            cursor.get("activeNodeId").and_then(|value| value.as_str()),
            Some("node-1")
        );
    }
}
