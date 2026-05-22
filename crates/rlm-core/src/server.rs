use std::net::SocketAddr;
use std::path::PathBuf;

use axum::Router;
use tokio::net::TcpListener;

use crate::control_server;

pub struct ServerConfig {
    pub port: u16,
    pub ui_dist_dir: Option<PathBuf>,
    pub project_root: PathBuf,
}

pub struct ControlServer {
    pub port: u16,
    pub url: String,
    shutdown: tokio::sync::oneshot::Sender<()>,
    join: tokio::task::JoinHandle<()>,
}

pub async fn start_server(config: ServerConfig) -> Result<ControlServer, std::io::Error> {
    let app: Router = control_server::build_router(control_server::RouterState {
        ui_dist_dir: config.ui_dist_dir,
        project_root: config.project_root,
    });

    let addr = SocketAddr::from(([127, 0, 0, 1], config.port));
    let listener = TcpListener::bind(addr).await?;
    let bound = listener.local_addr()?;
    let (shutdown_tx, shutdown_rx) = tokio::sync::oneshot::channel();

    let join = tokio::spawn(async move {
        axum::serve(listener, app)
            .with_graceful_shutdown(async {
                let _ = shutdown_rx.await;
            })
            .await
            .ok();
    });

    Ok(ControlServer {
        port: bound.port(),
        url: format!("http://127.0.0.1:{}", bound.port()),
        shutdown: shutdown_tx,
        join,
    })
}

impl ControlServer {
    pub async fn close(self) {
        let _ = self.shutdown.send(());
        let _ = self.join.await;
    }
}
