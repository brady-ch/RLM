use std::collections::HashSet;
use std::sync::Arc;

use serde_json::json;

use super::run_state_types::ResumeCursor;
use crate::ports::{RunStateMutationRequest, RunStateSnapshot, RunStateStorePort};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct LoadedResumeState {
    pub completed_node_ids: Vec<String>,
    pub active_node_id: Option<String>,
    pub variant: Option<String>,
}

pub struct RunStatePersistence {
    run_id: String,
    store: Arc<dyn RunStateStorePort>,
    actor: String,
    capability_token: String,
}

impl RunStatePersistence {
    pub fn new(run_id: impl Into<String>, store: Arc<dyn RunStateStorePort>) -> Self {
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

    pub fn get_snapshot(&self) -> std::io::Result<Option<RunStateSnapshot>> {
        self.store.get_snapshot(&self.run_id)
    }

    pub fn load_resume_state(&self) -> std::io::Result<Option<LoadedResumeState>> {
        let Some(snapshot) = self.get_snapshot()? else {
            return Ok(None);
        };
        Ok(Some(parse_loaded_resume_state(&snapshot)))
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

pub fn parse_loaded_resume_state(snapshot: &RunStateSnapshot) -> LoadedResumeState {
    let mut completed = HashSet::new();
    for entry in &snapshot.node_statuses {
        if entry.status == "completed" {
            completed.insert(entry.node_id.clone());
        }
    }
    if let Some(cursor_value) = snapshot.resume_cursor.as_ref() {
        if let Ok(cursor) = serde_json::from_value::<ResumeCursor>(cursor_value.clone()) {
            for node_id in cursor.completed_node_ids {
                completed.insert(node_id);
            }
            return LoadedResumeState {
                completed_node_ids: completed.into_iter().collect(),
                active_node_id: Some(cursor.active_node_id),
                variant: Some(cursor.variant),
            };
        }
    }
    LoadedResumeState {
        completed_node_ids: completed.into_iter().collect(),
        active_node_id: None,
        variant: None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    use crate::persistence::FileRunStateStore;

    fn temp_dir(name: &str) -> std::path::PathBuf {
        let dir = std::env::temp_dir().join(format!("rlm-run-state-{name}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn run_state_persistence_seeds_snapshot_and_mutates_node_status() {
        let dir = temp_dir("persist");
        let store: Arc<dyn RunStateStorePort> = Arc::new(FileRunStateStore::new(dir));
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
        let store: Arc<dyn RunStateStorePort> = Arc::new(FileRunStateStore::new(dir));
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

    #[test]
    fn load_resume_state_merges_node_statuses_and_cursor() {
        let dir = temp_dir("load");
        let store: Arc<dyn RunStateStorePort> = Arc::new(FileRunStateStore::new(dir));
        let persistence = RunStatePersistence::new("run-load", Arc::clone(&store));
        persistence
            .initialize("hello", "default")
            .expect("initialize");
        persistence
            .persist_node_status("root", "completed")
            .expect("persist root");
        persistence
            .persist_resume_cursor(&super::super::run_state_types::ResumeCursor {
                active_node_id: "child".into(),
                completed_node_ids: vec!["root".into(), "child".into()],
                variant: "playbook".into(),
            })
            .expect("persist cursor");

        let loaded = persistence
            .load_resume_state()
            .expect("load")
            .expect("state");
        assert!(loaded.completed_node_ids.contains(&"root".to_string()));
        assert!(loaded.completed_node_ids.contains(&"child".to_string()));
        assert_eq!(loaded.active_node_id.as_deref(), Some("child"));
        assert_eq!(loaded.variant.as_deref(), Some("playbook"));
    }
}
