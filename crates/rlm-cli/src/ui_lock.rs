use std::fs;
use std::path::{Path, PathBuf};

use serde_json::{json, Value};

const LOCK_NAME: &str = "ui-server.lock";

#[derive(Debug, Clone)]
pub struct UiServerLock {
    path: PathBuf,
}

#[derive(Debug, Clone)]
pub struct UiLockRecord {
    pub pid: u32,
    pub port: u16,
    pub url: String,
}

impl UiServerLock {
    pub fn path_for(project_root: &Path) -> PathBuf {
        project_root.join(".rlm").join(LOCK_NAME)
    }

    pub fn acquire(project_root: &Path, pid: u32, port: u16, url: &str) -> Result<Self, String> {
        let path = Self::path_for(project_root);
        if let Some(existing) = Self::read_record(&path)? {
            if process_alive(existing.pid) {
                return Err(format!(
                    "RLM UI server already running (pid {}, {}). Stop it with `rlm ui --stop` or use `--replace`.",
                    existing.pid, existing.url
                ));
            }
            let _ = fs::remove_file(&path);
        }

        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).map_err(|err| err.to_string())?;
        }
        let payload = json!({
            "pid": pid,
            "port": port,
            "url": url,
        });
        fs::write(&path, serde_json::to_string_pretty(&payload).unwrap_or_default())
            .map_err(|err| err.to_string())?;
        Ok(Self { path })
    }

    pub fn read_record(path: &Path) -> Result<Option<UiLockRecord>, String> {
        let raw = match fs::read_to_string(path) {
            Ok(raw) => raw,
            Err(err) if err.kind() == std::io::ErrorKind::NotFound => return Ok(None),
            Err(err) => return Err(err.to_string()),
        };
        let value: Value = serde_json::from_str(&raw).map_err(|err| err.to_string())?;
        let Some(pid) = value.get("pid").and_then(Value::as_u64) else {
            return Ok(None);
        };
        Ok(Some(UiLockRecord {
            pid: pid as u32,
            port: value
                .get("port")
                .and_then(Value::as_u64)
                .unwrap_or(0) as u16,
            url: value
                .get("url")
                .and_then(Value::as_str)
                .unwrap_or("")
                .to_string(),
        }))
    }

    pub fn stop_running(project_root: &Path) -> Result<Option<UiLockRecord>, String> {
        let path = Self::path_for(project_root);
        let Some(record) = Self::read_record(&path)? else {
            return Ok(None);
        };
        if process_alive(record.pid) {
            signal_stop(record.pid)?;
        }
        let _ = fs::remove_file(&path);
        Ok(Some(record))
    }

    pub fn release(self) {
        let _ = fs::remove_file(&self.path);
    }
}

fn process_alive(pid: u32) -> bool {
    std::process::Command::new("kill")
        .args(["-0", &pid.to_string()])
        .status()
        .map(|status| status.success())
        .unwrap_or(false)
}

fn signal_stop(pid: u32) -> Result<(), String> {
    let status = std::process::Command::new("kill")
        .args(["-TERM", &pid.to_string()])
        .status()
        .map_err(|err| err.to_string())?;
    if status.success() {
        Ok(())
    } else {
        Err(format!("Failed to send SIGTERM to pid {pid}."))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn acquire_and_release_lock() {
        let temp = tempfile::tempdir().expect("tempdir");
        let lock = UiServerLock::acquire(temp.path(), 4242, 8080, "http://127.0.0.1:8080")
            .expect("acquire lock");
        assert!(UiServerLock::path_for(temp.path()).is_file());
        lock.release();
        assert!(!UiServerLock::path_for(temp.path()).exists());
    }

    #[test]
    fn second_acquire_fails_while_pid_alive() {
        let temp = tempfile::tempdir().expect("tempdir");
        let pid = std::process::id();
        let _lock = UiServerLock::acquire(temp.path(), pid, 8080, "http://127.0.0.1:8080")
            .expect("acquire lock");
        let err = UiServerLock::acquire(temp.path(), pid + 1, 8081, "http://127.0.0.1:8081")
            .expect_err("duplicate lock");
        assert!(err.contains("already running"));
    }
}
