use std::collections::HashSet;
use std::io;
use std::path::PathBuf;

use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::domain::types::MemoryPacketMetadata;

use super::super::util::read_json_array;
use super::FileMemoryStore;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EpisodicMemoryEntry {
    pub id: String,
    pub session_id: String,
    #[serde(rename = "type")]
    pub entry_type: String,
    pub summary: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub node_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub scope_ids: Option<Vec<String>>,
    pub timestamp: String,
}

impl FileMemoryStore {
    pub fn list_episodic(&self, session_id: &str) -> io::Result<Vec<EpisodicMemoryEntry>> {
        read_json_array(&self.episodic_path(session_id))
    }

    pub fn get_rolling_summary(
        &self,
        session_id: &str,
        scope_ids: &[String],
        max_chars: usize,
    ) -> io::Result<String> {
        let allowed: HashSet<String> = scope_ids.iter().cloned().collect();
        let entries = self.list_episodic(session_id)?;
        let lines: Vec<String> = entries
            .into_iter()
            .filter(|entry| {
                entry.scope_ids.as_ref().is_none_or(|scopes| {
                    scopes.is_empty() || scopes.iter().any(|s| allowed.contains(s))
                })
            })
            .rev()
            .take(12)
            .collect::<Vec<_>>()
            .into_iter()
            .rev()
            .map(|entry| {
                format!(
                    "- {}{}: {}",
                    entry.entry_type,
                    entry
                        .node_id
                        .as_ref()
                        .map(|id| format!(" {id}"))
                        .unwrap_or_default(),
                    entry.summary
                )
            })
            .collect();
        Ok(truncate_text(&lines.join("\n"), max_chars))
    }

    pub fn record_packet_metadata(&self, metadata: &MemoryPacketMetadata) -> io::Result<()> {
        let session_id = metadata.session_id.clone();
        let mut packets = self.list_packet_metadata(&session_id)?;
        packets.retain(|packet| {
            packet
                .get("nodeId")
                .and_then(Value::as_str)
                .is_none_or(|id| id != metadata.node_id)
        });
        packets.push(
            serde_json::to_value(metadata)
                .map_err(|err| io::Error::new(io::ErrorKind::InvalidData, err.to_string()))?,
        );
        let trimmed: Vec<_> = packets.into_iter().rev().take(200).rev().collect();
        self.write_json(
            &self.packet_path(&session_id),
            &serde_json::to_value(&trimmed)?,
        )
    }

    pub fn append_episodic(&self, entry: EpisodicMemoryEntry) -> io::Result<()> {
        let session_id = entry.session_id.clone();
        let mut entries = self.list_episodic(&session_id)?;
        entries.push(entry);
        let trimmed: Vec<_> = entries.into_iter().rev().take(500).rev().collect();
        self.write_json(
            &self.episodic_path(&session_id),
            &serde_json::to_value(&trimmed)?,
        )
    }

    pub fn list_packet_metadata(&self, session_id: &str) -> io::Result<Vec<Value>> {
        read_json_array(&self.packet_path(session_id))
    }

    pub(super) fn episodic_path(&self, session_id: &str) -> PathBuf {
        self.session_dir(session_id).join("episodic.json")
    }

    pub(super) fn packet_path(&self, session_id: &str) -> PathBuf {
        self.session_dir(session_id).join("packets.json")
    }
}

fn truncate_text(text: &str, max_chars: usize) -> String {
    if text.len() <= max_chars {
        return text.to_string();
    }
    let keep = max_chars.saturating_sub(15);
    format!(
        "{}\n[truncated]",
        text.chars().take(keep).collect::<String>().trim_end()
    )
}
