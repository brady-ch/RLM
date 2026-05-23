use std::sync::Mutex;

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use uuid::Uuid;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum RuntimeEventSeverity {
    Info,
    Warn,
    Error,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeEvent {
    pub event_id: String,
    pub fingerprint: String,
    pub run_id: String,
    pub code: String,
    pub severity: RuntimeEventSeverity,
    pub source: String,
    pub subject: String,
    pub occurred_at: String,
    pub seq: u64,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub metrics: Option<serde_json::Value>,
}

pub struct RuntimeEventInput {
    pub run_id: String,
    pub code: String,
    pub severity: RuntimeEventSeverity,
    pub source: String,
    pub subject: String,
    pub occurred_at: String,
    pub seq: u64,
    pub message: String,
    pub metrics: Option<serde_json::Value>,
}

pub fn create_runtime_event_fingerprint(input: &RuntimeEventInput) -> String {
    let base = format!(
        "{}|{}|{}|{}|{}|{}",
        input.run_id, input.occurred_at, input.code, input.source, input.subject, input.seq
    );
    let mut hasher = Sha256::new();
    hasher.update(base.as_bytes());
    format!("{:x}", hasher.finalize())
}

pub fn create_runtime_event(input: RuntimeEventInput) -> RuntimeEvent {
    let fingerprint = create_runtime_event_fingerprint(&input);
    RuntimeEvent {
        event_id: Uuid::new_v4().to_string(),
        fingerprint,
        run_id: input.run_id,
        code: input.code,
        severity: input.severity,
        source: input.source,
        subject: input.subject,
        occurred_at: input.occurred_at,
        seq: input.seq,
        message: input.message,
        metrics: input.metrics,
    }
}

pub fn runtime_event_occurred_at_now() -> String {
    time::OffsetDateTime::now_utc()
        .format(&time::format_description::well_known::Rfc3339)
        .unwrap_or_else(|_| "1970-01-01T00:00:00Z".into())
}

pub trait RuntimeEventSink: Send + Sync {
    fn emit(&self, event: RuntimeEvent) -> Result<(), String>;
}

pub struct NoopRuntimeEventSink;

impl RuntimeEventSink for NoopRuntimeEventSink {
    fn emit(&self, _event: RuntimeEvent) -> Result<(), String> {
        Ok(())
    }
}

pub struct InMemoryRuntimeEventStore {
    pub events: Mutex<Vec<RuntimeEvent>>,
}

impl Default for InMemoryRuntimeEventStore {
    fn default() -> Self {
        Self::new()
    }
}

impl InMemoryRuntimeEventStore {
    pub fn new() -> Self {
        Self {
            events: Mutex::new(Vec::new()),
        }
    }
}

impl RuntimeEventSink for InMemoryRuntimeEventStore {
    fn emit(&self, event: RuntimeEvent) -> Result<(), String> {
        self.events
            .lock()
            .map_err(|err| err.to_string())?
            .push(event);
        Ok(())
    }
}
