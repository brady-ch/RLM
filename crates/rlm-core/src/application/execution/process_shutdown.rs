use std::future::Future;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};

use tokio::task::JoinHandle;

/// Tracks process shutdown and background tasks so memory and executors can be released cleanly.
#[derive(Clone, Default)]
pub struct ProcessShutdown {
    requested: Arc<AtomicBool>,
    tasks: Arc<Mutex<Vec<JoinHandle<()>>>>,
}

impl ProcessShutdown {
    pub fn is_shutdown(&self) -> bool {
        self.requested.load(Ordering::SeqCst)
    }

    pub fn spawn<F>(&self, future: F)
    where
        F: Future<Output = ()> + Send + 'static,
    {
        if self.is_shutdown() {
            return;
        }
        let shutdown = self.requested.clone();
        let handle = tokio::spawn(async move {
            if shutdown.load(Ordering::SeqCst) {
                return;
            }
            future.await;
        });
        self.tasks
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
            .push(handle);
    }

    pub fn shutdown(&self, reason: &str) {
        self.requested.store(true, Ordering::SeqCst);
        self.cancel_running_tasks();
        tracing::debug!(reason, "process shutdown requested");
    }

    /// Abort in-flight background tasks without marking the process shut down.
    pub fn cancel_running_tasks(&self) {
        let mut tasks = self
            .tasks
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        for handle in tasks.drain(..) {
            handle.abort();
        }
    }
}
