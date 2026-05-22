mod commands;
mod exec_control;
mod flags;

use std::path::{Path, PathBuf};

use clap::Parser;
use commands::{ask, plugin, session, ui, workflow_io, Commands, PlanNodeCommand};
use flags::CommandContext;

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

    let Cli {
        json,
        project_root,
        config,
        command,
    } = Cli::parse();

    match command.unwrap_or(Commands::Ui {
        port: 0,
        ui_dist: None,
        flags: flags::ExecutionFlags::default(),
    }) {
        Commands::Ui {
            port,
            ui_dist,
            flags,
        } => {
            let ctx = command_context(&project_root, &config, json, flags);
            if session::handle_session_flags(&ctx).await? {
                return Ok(());
            }
            ui::run(port, ui_dist, project_root).await
        }
        Commands::Ask {
            prompt_parts,
            flags,
        } => {
            let ctx = command_context(&project_root, &config, json, flags);
            if session::handle_session_flags(&ctx).await? {
                return Ok(());
            }
            ask::run(&ctx, prompt_parts).await
        }
        Commands::PlanNode {
            flags,
            prompt_parts,
        } => {
            let ctx = command_context(&project_root, &config, json, flags);
            if session::handle_session_flags(&ctx).await? {
                return Ok(());
            }
            PlanNodeCommand::run(&ctx, prompt_parts).await
        }
        Commands::WorkflowExport { flags } => {
            let ctx = command_context(&project_root, &config, json, flags);
            if session::handle_session_flags(&ctx).await? {
                return Ok(());
            }
            workflow_io::run_export(&ctx).await
        }
        Commands::WorkflowImport { flags } => {
            let ctx = command_context(&project_root, &config, json, flags);
            if session::handle_session_flags(&ctx).await? {
                return Ok(());
            }
            workflow_io::run_import(&ctx).await
        }
        Commands::Plugin { sub } => plugin::run(sub, project_root, config, json).await,
    }
}

fn command_context(
    project_root: &Path,
    config: &Option<PathBuf>,
    json: bool,
    flags: flags::ExecutionFlags,
) -> CommandContext {
    CommandContext {
        project_root: project_root.to_path_buf(),
        config_path: config.clone(),
        json,
        flags,
    }
}
