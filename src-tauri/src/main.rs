use std::path::PathBuf;
use std::process::{Command, Stdio};
use std::sync::Arc;
use std::time::Duration;

use rlm_core::{start_server, ControlServer, ServerConfig};
use tauri::{Manager, WindowEvent};

struct EmbeddedRuntime {
    rt: tokio::runtime::Runtime,
    server: std::sync::Mutex<Option<ControlServer>>,
}

impl EmbeddedRuntime {
    fn new(rt: tokio::runtime::Runtime, server: ControlServer) -> Self {
        Self {
            rt,
            server: std::sync::Mutex::new(Some(server)),
        }
    }

    fn stop(&self) {
        let mut guard = self.server.lock().expect("embedded server mutex");
        if let Some(server) = guard.take() {
            self.rt.block_on(server.close());
        }
    }
}

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            let release_root = resolve_release_root(app)?;
            ensure_ollama_ready()?;

            let ui_dist = release_root.join("ui-dist");
            let ui_dist_dir = ui_dist.is_dir().then_some(ui_dist);

            let rt = tokio::runtime::Runtime::new()?;
            let server = rt.block_on(start_server(ServerConfig {
                port: 0,
                ui_dist_dir,
                project_root: release_root.clone(),
                memory_session_id: None,
                session: None,
            }))?;

            let url = server.url.clone();
            eprintln!("RLM UI listening at {url}");

            let runtime = Arc::new(EmbeddedRuntime::new(rt, server));
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

            let _ = window.eval(format!(
                "window.location.replace('{}');",
                escape_js_string(&url)
            ));

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("failed to run RLM desktop shell");
}

fn ensure_ollama_ready() -> Result<(), Box<dyn std::error::Error>> {
    let base_url =
        std::env::var("OLLAMA_HOST").unwrap_or_else(|_| "http://127.0.0.1:11434".to_string());
    let trimmed = base_url.trim_end_matches('/');
    let client = reqwest::blocking::Client::builder()
        .timeout(Duration::from_secs(2))
        .build()?;

    if client
        .get(format!("{trimmed}/api/version"))
        .send()
        .map(|response| response.status().is_success())
        .unwrap_or(false)
    {
        eprintln!("[rlm desktop] Ollama ready at {base_url}");
        return Ok(());
    }

    if std::env::var("RLM_MANAGE_OLLAMA").ok().as_deref() == Some("1") {
        let mut child = Command::new("ollama");
        child
            .arg("serve")
            .stdin(Stdio::null())
            .stdout(Stdio::null());
        #[cfg(unix)]
        {
            use std::os::unix::process::CommandExt;
            child.process_group(0);
        }
        let _ = child.spawn();

        for _ in 0..30 {
            std::thread::sleep(Duration::from_millis(500));
            if client
                .get(format!("{trimmed}/api/version"))
                .send()
                .map(|response| response.status().is_success())
                .unwrap_or(false)
            {
                eprintln!("[rlm desktop] Ollama started at {base_url}");
                return Ok(());
            }
        }
    }

    Err(format!(
        "Ollama unavailable at {base_url}. Set RLM_MANAGE_OLLAMA=1 to start 'ollama serve'."
    )
    .into())
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

    // Dev fallback: repo root when release bundle not staged yet.
    Ok(PathBuf::from(env!("CARGO_MANIFEST_DIR")).join(".."))
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
