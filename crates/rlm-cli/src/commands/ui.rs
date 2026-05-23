use std::path::PathBuf;

use rlm_core::{start_server, ServerConfig};

pub async fn run(
    port: u16,
    ui_dist: Option<PathBuf>,
    project_root: PathBuf,
) -> Result<(), Box<dyn std::error::Error>> {
    let ui_dist = ui_dist.or_else(|| std::env::var("RLM_UI_DIST").ok().map(PathBuf::from));

    let server = start_server(ServerConfig {
        port,
        ui_dist_dir: ui_dist,
        project_root,
        memory_session_id: None,
        session: None,
        exec_model: None,
    })
    .await?;

    eprintln!("RLM UI listening at {}", server.url);
    eprintln!("Press Ctrl+C to stop.");

    tokio::signal::ctrl_c().await?;
    server.close().await;
    Ok(())
}
