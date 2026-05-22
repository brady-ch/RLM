use std::path::PathBuf;

use clap::Parser;
use rlm_core::{start_server, ServerConfig};

#[derive(Parser, Debug)]
#[command(name = "rlm", about = "Recursive Language Model CLI (Rust runtime)")]
struct Args {
    /// Port for the control server (0 = ephemeral)
    #[arg(long, default_value_t = 0)]
    port: u16,

    /// Path to built UI assets (ui/dist)
    #[arg(long)]
    ui_dist: Option<PathBuf>,

    /// Project root for config resolution
    #[arg(long, default_value = ".")]
    project_root: PathBuf,
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
        .init();

    let args = Args::parse();
    let ui_dist = args
        .ui_dist
        .or_else(|| std::env::var("RLM_UI_DIST").ok().map(PathBuf::from));

    let server = start_server(ServerConfig {
        port: args.port,
        ui_dist_dir: ui_dist,
        project_root: args.project_root,
        memory_session_id: None,
    })
    .await?;

    eprintln!("RLM UI listening at {}", server.url);
    eprintln!("Press Ctrl+C to stop.");

    tokio::signal::ctrl_c().await?;
    server.close().await;
    Ok(())
}
