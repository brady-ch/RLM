use std::sync::Arc;

use serde_json::json;

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
        let Some(snapshot) = self.store.get_snapshot(&self.run_id)? else {
            return Ok(());
        };
        let updated_at = time::OffsetDateTime::now_utc()
            .format(&time::format_description::well_known::Rfc3339)
            .unwrap_or_else(|_| "1970-01-01T00:00:00Z".to_string());
        self.store.mutate(
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

        let snapshot = store.get_snapshot("run-test").expect("get").expect("exists");
        assert!(!snapshot.mutation_log.is_empty());
        assert!(snapshot
            .node_statuses
            .iter()
            .any(|entry| entry.node_id == "root-composer" && entry.status == "completed"));
    }
}
