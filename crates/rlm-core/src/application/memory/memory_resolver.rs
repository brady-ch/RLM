use std::sync::Arc;

use crate::application::memory::SemanticMemoryIndex;
use crate::domain::types::ComposerContextPolicy;
use crate::domain::types::{
    MemoryPacketMetadata, MemoryPacketProvenance, MemoryPacketRetrievalHit,
};
use crate::persistence::{EpisodicMemoryEntry, FileMemoryStore, RetrievalStatus};
use crate::ports::{MemoryContextPacket, MemoryContextPort};

pub struct MemoryResolver {
    store: FileMemoryStore,
    session_id: String,
    retrieval: Option<Arc<SemanticMemoryIndex>>,
}

impl MemoryResolver {
    pub fn new(
        store: FileMemoryStore,
        session_id: impl Into<String>,
        retrieval: Option<Arc<SemanticMemoryIndex>>,
    ) -> Self {
        Self {
            store,
            session_id: session_id.into(),
            retrieval,
        }
    }

    pub fn session_id(&self) -> &str {
        &self.session_id
    }

    pub async fn build_packet(
        &self,
        node_id: &str,
        prompt: &str,
        policy: &ComposerContextPolicy,
    ) -> Result<Option<MemoryContextPacket>, String> {
        if policy.memory_scopes.is_empty() {
            return Ok(None);
        }

        let char_limit = resolve_char_limit(&policy.limits);
        let mut provenance = Vec::new();
        let mut reasons = Vec::new();
        let mut chunks = Vec::new();
        let mut degraded = false;

        for scope_id in &policy.memory_scopes {
            match self.store.read_scope(&self.session_id, scope_id) {
                Ok(Some(scope)) => {
                    provenance.push(MemoryPacketProvenance {
                        kind: "scope".into(),
                        id: scope_id.clone(),
                        version: Some(scope.version),
                    });
                    chunks.push(format!(
                        "Scope {scope_id} v{}:\n{}",
                        scope.version,
                        scope.content
                    ));
                }
                Ok(None) => {
                    reasons.push(format!("scope missing: {scope_id}"));
                    degraded = true;
                }
                Err(err) => {
                    degraded = true;
                    reasons.push(format!("scope {scope_id} read failed: {err}"));
                }
            }
        }

        match self.store.get_rolling_summary(
            &self.session_id,
            &policy.memory_scopes,
            char_limit / 2,
        ) {
            Ok(summary) if !summary.is_empty() => {
                provenance.push(MemoryPacketProvenance {
                    kind: "episodic".into(),
                    id: "rolling-summary".into(),
                    version: None,
                });
                chunks.push(format!("Rolling summary:\n{summary}"));
            }
            Ok(_) => {}
            Err(err) => {
                degraded = true;
                reasons.push(format!("rolling summary read failed: {err}"));
            }
        }

        let mut retrieval_hits = None;
        if policy.reads.iter().any(|read| read.to_lowercase().contains("relevant memory")) {
            if let Some(index) = &self.retrieval {
                let result = index
                    .search(prompt, &policy.memory_scopes, 4)
                    .await;
                if result.status == RetrievalStatus::Ready && !result.hits.is_empty() {
                    retrieval_hits = Some(
                        result
                            .hits
                            .iter()
                            .map(|hit| MemoryPacketRetrievalHit {
                                id: hit.id.clone(),
                                scope_id: hit.scope_id.clone(),
                                source: hit.source.clone(),
                                snippet: hit.snippet.clone(),
                                score: hit.score,
                            })
                            .collect(),
                    );
                    for hit in &result.hits {
                        provenance.push(MemoryPacketProvenance {
                            kind: "retrieval".into(),
                            id: hit.id.clone(),
                            version: None,
                        });
                    }
                    chunks.push(format!(
                        "Retrieval hits:\n{}",
                        result
                            .hits
                            .iter()
                            .map(|hit| {
                                format!(
                                    "- {}:{} score={:.3} {}",
                                    hit.source, hit.scope_id, hit.score, hit.snippet
                                )
                            })
                            .collect::<Vec<_>>()
                            .join("\n")
                    ));
                } else if result.status == RetrievalStatus::Degraded {
                    degraded = true;
                    reasons.push(format!(
                        "retrieval degraded: {}",
                        result.reason.unwrap_or_else(|| "unknown reason".into())
                    ));
                }
            }
        }

        let raw = chunks.join("\n\n");
        let text = truncate_packet_text(&raw, char_limit);
        let metadata = MemoryPacketMetadata {
            session_id: self.session_id.clone(),
            node_id: node_id.to_string(),
            scope_ids: policy.memory_scopes.clone(),
            char_limit: char_limit as u32,
            chars_used: text.len(),
            truncated: raw.len() > text.len(),
            degraded,
            reasons,
            provenance,
            retrieval_hits,
            created_at: iso_timestamp(),
        };

        self.store
            .record_packet_metadata(&metadata)
            .map_err(|err| err.to_string())?;

        if text.is_empty() && metadata.reasons.is_empty() {
            return Ok(None);
        }

        let wrapped = if text.is_empty() {
            String::new()
        } else {
            format!("<memory_context>\n{text}\n</memory_context>")
        };

        Ok(Some(MemoryContextPacket {
            text: wrapped,
            metadata,
        }))
    }

    pub fn append_node_summary(
        &self,
        node_id: &str,
        summary: &str,
        scope_ids: &[String],
    ) -> Result<(), String> {
        let entry = EpisodicMemoryEntry {
            id: format!(
                "episode-{}-{}",
                std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .map(|d| d.as_nanos())
                    .unwrap_or(0),
                node_id
            ),
            session_id: self.session_id.clone(),
            entry_type: "summary".into(),
            summary: truncate_packet_text(summary, 600),
            node_id: Some(node_id.to_string()),
            scope_ids: Some(scope_ids.to_vec()),
            timestamp: iso_timestamp(),
        };
        self.store
            .append_episodic(entry)
            .map_err(|err| err.to_string())?;
        if let Some(index) = &self.retrieval {
            index.enqueue_rebuild();
        }
        Ok(())
    }
}

fn resolve_char_limit(limits: &[String]) -> usize {
    for limit in limits {
        if let Some(captures) = regex_lite(limit) {
            return captures.max(256);
        }
    }
    2_000
}

fn regex_lite(limit: &str) -> Option<usize> {
    let lower = limit.to_lowercase();
    let digits: String = lower.chars().filter(|c| c.is_ascii_digit()).collect();
    if digits.len() >= 3 {
        digits.parse().ok().map(|n: usize| n)
    } else {
        None
    }
}

fn truncate_packet_text(text: &str, max_chars: usize) -> String {
    if text.len() <= max_chars {
        return text.to_string();
    }
    let keep = max_chars.saturating_sub(15);
    format!(
        "{}\n[truncated]",
        text.chars().take(keep).collect::<String>().trim_end()
    )
}

fn iso_timestamp() -> String {
    time::OffsetDateTime::now_utc()
        .format(&time::format_description::well_known::Rfc3339)
        .unwrap_or_else(|_| "1970-01-01T00:00:00Z".to_string())
}

#[async_trait::async_trait]
impl MemoryContextPort for MemoryResolver {
    async fn build_packet(
        &self,
        node_id: &str,
        prompt: &str,
        policy: &ComposerContextPolicy,
    ) -> Result<Option<MemoryContextPacket>, String> {
        MemoryResolver::build_packet(self, node_id, prompt, policy).await
    }

    fn append_node_summary(
        &self,
        node_id: &str,
        summary: &str,
        scope_ids: &[String],
    ) -> Result<(), String> {
        MemoryResolver::append_node_summary(self, node_id, summary, scope_ids)
    }
}

#[cfg(test)]
#[path = "../../../tests/application/memory/memory_resolver.rs"]
mod memory_resolver_tests;
