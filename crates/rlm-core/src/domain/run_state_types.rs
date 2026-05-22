use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ResumeCursor {
    pub active_node_id: String,
    pub completed_node_ids: Vec<String>,
    pub variant: String,
}
