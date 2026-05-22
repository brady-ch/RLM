mod commands;

use std::path::PathBuf;

use clap::Parser;
use commands::{ask, plugin, ui, Commands};

#[derive(Parser, Debug)]
#[command(name = "rlm", about = "Recursive Language Model CLI (Rust runtime)")]
struct Cli {
    /// Emit JSON output where supported
    #[arg(long, global = true)]
    json: bool,

    /// Project root for config resolution
    #[arg(long, global = true, default_value = ".")]
    project_root: PathBuf,

    /// Explicit project config path
    #[arg(long, global = true)]
    config: Option<PathBuf>,

    #[command(subcommand)]
    command: Option<Commands>,
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
        .init();

    let cli = Cli::parse();

    match cli.command.unwrap_or(Commands::Ui {
        port: 0,
        ui_dist: None,
    }) {
        Commands::Ui { port, ui_dist } => ui::run(port, ui_dist, cli.project_root).await,
        Commands::Ask { prompt } => ask::run(prompt, cli.json),
        Commands::Plugin { sub } => plugin::run(sub, cli.project_root, cli.config, cli.json).await,
        Commands::PlanNode { .. } => commands::not_implemented("plan-node"),
        Commands::WorkflowExport => commands::not_implemented("workflow-export"),
        Commands::WorkflowImport => commands::not_implemented("workflow-import"),
    }
}
