use std::io;

use serde::{Deserialize, Serialize};
use serde_json::Value;

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

pub trait RunStateStorePort: Send + Sync {
    fn get_snapshot(&self, run_id: &str) -> io::Result<Option<RunStateSnapshot>>;

    fn create_run(
        &self,
        run_id: &str,
        seed_metadata: Option<Value>,
    ) -> io::Result<RunStateSnapshot>;

    fn mutate(
        &self,
        run_id: &str,
        request: RunStateMutationRequest,
    ) -> io::Result<RunStateMutationResult>;

    fn register_capability_token(&self, run_id: &str, actor: &str, token: &str) -> io::Result<()>;
}
