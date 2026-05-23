use std::path::PathBuf;

use rlm_core::{start_server, ControlServer, ServerConfig};

use crate::ui_lock::UiServerLock;

pub async fn run(
    port: u16,
    ui_dist: Option<PathBuf>,
    project_root: PathBuf,
    stop: bool,
    replace: bool,
) -> Result<(), Box<dyn std::error::Error>> {
    if stop {
        match UiServerLock::stop_running(&project_root)? {
            Some(record) => {
                eprintln!(
                    "Stopped RLM UI server (pid {}, port {}, {}).",
                    record.pid, record.port, record.url
                );
            }
            None => {
                eprintln!("No RLM UI server lock file found for this project.");
            }
        }
        return Ok(());
    }

    if replace {
        if let Some(record) = UiServerLock::stop_running(&project_root)? {
            eprintln!(
                "Stopped previous RLM UI server (pid {}, port {}).",
                record.pid, record.port
            );
            tokio::time::sleep(std::time::Duration::from_millis(300)).await;
        }
    }

    let ui_dist = ui_dist.or_else(|| std::env::var("RLM_UI_DIST").ok().map(PathBuf::from));

    let server = start_server(ServerConfig {
        port,
        ui_dist_dir: ui_dist,
        project_root: project_root.clone(),
        memory_session_id: None,
        session: None,
        exec_model: None,
    })
    .await?;

    let lock = UiServerLock::acquire(
        &project_root,
        std::process::id(),
        server.port,
        &server.url,
    )
    .map_err(|err| -> Box<dyn std::error::Error> { err.into() })?;

    eprintln!("RLM UI listening at {}", server.url);
    eprintln!("Press Ctrl+C to stop, or run `rlm ui --stop` from another terminal.");

    let shutdown = wait_for_shutdown_signal();
    shutdown.await;
    shutdown_server(server).await;
    lock.release();
    Ok(())
}

async fn wait_for_shutdown_signal() {
    #[cfg(unix)]
    {
        use tokio::signal::unix::{signal, SignalKind};

        let mut terminate = signal(SignalKind::terminate()).expect("install SIGTERM handler");
        let mut interrupt = signal(SignalKind::interrupt()).expect("install SIGINT handler");
        tokio::select! {
            _ = terminate.recv() => {}
            _ = interrupt.recv() => {}
        }
    }
    #[cfg(not(unix))]
    {
        let _ = tokio::signal::ctrl_c().await;
    }
}

async fn shutdown_server(server: ControlServer) {
    let shutdown = server.close();
    tokio::time::timeout(std::time::Duration::from_secs(10), shutdown)
        .await
        .unwrap_or_else(|_| {
            eprintln!("Warning: UI server shutdown timed out after 10s.");
        });
}
