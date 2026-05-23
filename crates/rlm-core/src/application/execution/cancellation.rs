#[derive(Debug, Clone)]
pub struct CancellationController {
    cancelled: std::sync::Arc<std::sync::atomic::AtomicBool>,
    reason: std::sync::Arc<std::sync::Mutex<Option<String>>>,
}

impl CancellationController {
    pub fn new() -> Self {
        Self {
            cancelled: std::sync::Arc::new(std::sync::atomic::AtomicBool::new(false)),
            reason: std::sync::Arc::new(std::sync::Mutex::new(None)),
        }
    }

    pub fn is_cancelled(&self) -> bool {
        self.cancelled.load(std::sync::atomic::Ordering::SeqCst)
    }

    pub fn cancel_reason(&self) -> Option<String> {
        self.reason.lock().expect("cancel lock").clone()
    }

    pub fn cancel(&self, reason: impl Into<String>) {
        self.cancelled
            .store(true, std::sync::atomic::Ordering::SeqCst);
        *self.reason.lock().expect("cancel lock") = Some(reason.into());
    }

    pub fn reset(&self) {
        self.cancelled
            .store(false, std::sync::atomic::Ordering::SeqCst);
        *self.reason.lock().expect("cancel lock") = None;
    }
}

impl Default for CancellationController {
    fn default() -> Self {
        Self::new()
    }
}
