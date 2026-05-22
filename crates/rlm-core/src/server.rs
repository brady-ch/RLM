use std::net::SocketAddr;
use std::path::PathBuf;
use std::sync::Arc;

use axum::Router;
use tokio::net::TcpListener;

use crate::control_server;
use crate::execution::InteractiveExecutionSession;

pub struct ServerConfig {
    pub port: u16,
    pub ui_dist_dir: Option<PathBuf>,
    pub project_root: PathBuf,
    pub memory_session_id: Option<String>,
    pub session: Option<Arc<InteractiveExecutionSession>>,
}

pub struct ControlServer {
    pub port: u16,
    pub url: String,
    shutdown: tokio::sync::oneshot::Sender<()>,
    join: tokio::task::JoinHandle<()>,
}

pub async fn start_server(config: ServerConfig) -> Result<ControlServer, std::io::Error> {
    let mut router_state =
        control_server::RouterState::new(config.project_root).with_ui_dist(config.ui_dist_dir);
    if let Some(session_id) = config.memory_session_id {
        router_state = router_state.with_memory_session_id(session_id);
    }
    if let Some(session) = config.session {
        router_state = router_state.with_session(session);
    }
    let app: Router = control_server::build_router(router_state);

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
