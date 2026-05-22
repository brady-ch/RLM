use std::sync::Mutex;

use crate::domain::types::TraceEvent;

pub trait Trace: Send + Sync {
    fn record(&self, event: TraceEvent);
    fn events(&self) -> Vec<TraceEvent>;
}

pub struct InMemoryTrace {
    events: Mutex<Vec<TraceEvent>>,
}

impl InMemoryTrace {
    pub fn new() -> Self {
        Self {
            events: Mutex::new(Vec::new()),
        }
    }
}

impl Default for InMemoryTrace {
    fn default() -> Self {
        Self::new()
    }
}

impl Trace for InMemoryTrace {
    fn record(&self, event: TraceEvent) {
        self.events.lock().expect("trace lock").push(event);
    }

    fn events(&self) -> Vec<TraceEvent> {
        self.events.lock().expect("trace lock").clone()
    }
}
