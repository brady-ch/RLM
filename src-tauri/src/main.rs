use std::{
    io::{BufRead, BufReader},
    path::PathBuf,
    process::{Child, Command, Stdio},
    sync::{Arc, Mutex},
    thread,
};

use tauri::{Manager, WindowEvent};

struct ManagedRuntime {
    child: Mutex<Option<Child>>,
}

impl ManagedRuntime {
    fn new(child: Child) -> Self {
        Self {
            child: Mutex::new(Some(child)),
        }
    }

    fn stop(&self) {
        let mut guard = self.child.lock().expect("runtime child mutex poisoned");
        if let Some(mut child) = guard.take() {
            let _ = child.kill();
            let _ = child.wait();
        }
    }
}

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            let release_root = resolve_release_root(app)?;
            ensure_ollama_ready(&release_root)?;
            let mut child = spawn_rlm_ui(&release_root)?;
            let stderr = child
                .stderr
                .take()
                .ok_or("failed to capture RLM UI stderr")?;
            let runtime = Arc::new(ManagedRuntime::new(child));
            let window = app
                .get_webview_window("main")
                .ok_or("missing main webview window")?;

            let runtime_for_close = Arc::clone(&runtime);
            window.on_window_event(move |event| {
                if matches!(
                    event,
                    WindowEvent::CloseRequested { .. } | WindowEvent::Destroyed
                ) {
                    runtime_for_close.stop();
                }
            });

            let window_for_redirect = window.clone();
            thread::spawn(move || {
                for line in BufReader::new(stderr).lines().map_while(Result::ok) {
                    eprintln!("{line}");
                    if let Some(url) = line.strip_prefix("RLM UI listening at ") {
                        let _ = window_for_redirect.eval(format!(
                            "window.location.replace('{}');",
                            escape_js_string(url.trim())
                        ));
                        break;
                    }
                }
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("failed to run RLM desktop shell");
}

fn spawn_rlm_ui(release_root: &PathBuf) -> Result<Child, Box<dyn std::error::Error>> {
    let mut command = if cfg!(windows) {
        let mut command = Command::new("cmd");
        command
            .arg("/C")
            .arg(release_root.join("rlm.cmd"))
            .arg("ui");
        command
    } else {
        let mut command = Command::new(release_root.join("rlm"));
        command.arg("ui");
        command
    };

    command
        .current_dir(release_root)
        .env("RLM_NON_INTERACTIVE", "1")
        .env("RLM_LAUNCH_MODE", "ui")
        .env("RLM_DESKTOP_MANAGED", "1")
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::piped());

    Ok(command.spawn()?)
}

fn ensure_ollama_ready(release_root: &PathBuf) -> Result<(), Box<dyn std::error::Error>> {
    let output = Command::new(node_runtime(release_root))
        .arg(release_root.join("ensure-ollama.mjs"))
        .env("RLM_DESKTOP_MANAGED", "1")
        .output()?;

    if output.status.success() {
        if !output.stderr.is_empty() {
            eprint!("{}", String::from_utf8_lossy(&output.stderr));
        }
        return Ok(());
    }

    let stderr = String::from_utf8_lossy(&output.stderr);
    Err(format!("Ollama readiness check failed: {}", stderr.trim()).into())
}

fn node_runtime(release_root: &PathBuf) -> PathBuf {
    if cfg!(windows) {
        release_root.join("bin").join("node.exe")
    } else {
        release_root.join("bin").join("node")
    }
}

fn resolve_release_root<R: tauri::Runtime>(
    app: &tauri::App<R>,
) -> Result<PathBuf, Box<dyn std::error::Error>> {
    let platform_tag = platform_tag();
    let resource_release = app
        .path()
        .resource_dir()?
        .join("release")
        .join(&platform_tag);
    if resource_release.exists() {
        return Ok(resource_release);
    }

    let dev_release = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("..")
        .join("dist")
        .join("release")
        .join(&platform_tag);
    if dev_release.exists() {
        return Ok(dev_release);
    }

    Err(format!(
        "RLM release runtime not found for {platform_tag}; run npm run package:build first"
    )
    .into())
}

fn platform_tag() -> String {
    let os = match std::env::consts::OS {
        "macos" => "darwin",
        "windows" => "win32",
        other => other,
    };
    let arch = match std::env::consts::ARCH {
        "x86_64" => "x64",
        "aarch64" => "arm64",
        other => other,
    };

    format!("{os}-{arch}")
}

fn escape_js_string(value: &str) -> String {
    value.replace('\\', "\\\\").replace('\'', "\\'")
}
