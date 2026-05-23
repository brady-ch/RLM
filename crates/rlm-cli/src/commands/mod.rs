pub mod ask;
pub mod plan_node;
pub mod plugin;
pub mod session;
pub mod ui;
pub mod workflow_io;

pub use plan_node::PlanNodeCommand;

use std::path::PathBuf;

use clap::Subcommand;

use crate::flags::ExecutionFlags;

#[derive(Subcommand, Debug)]
pub enum Commands {
    /// Start the control server and serve the UI
    Ui {
        /// Port for the control server (0 = ephemeral)
        #[arg(long, default_value_t = 0)]
        port: u16,

        /// Path to built UI assets (ui/dist)
        #[arg(long)]
        ui_dist: Option<PathBuf>,

        /// Stop a running UI server for this project (uses .rlm/ui-server.lock)
        #[arg(long)]
        stop: bool,

        /// Stop any existing UI server before starting a new one
        #[arg(long)]
        replace: bool,

        #[command(flatten)]
        flags: ExecutionFlags,
    },
    /// Run a one-shot prompt against the recursive engine
    Ask {
        /// Prompt text
        #[arg(value_name = "PROMPT")]
        prompt_parts: Vec<String>,

        #[command(flatten)]
        flags: ExecutionFlags,
    },
    /// Plugin registry administration
    Plugin {
        #[command(subcommand)]
        sub: PluginCommands,
    },
    /// Plan a node subgraph from the root composer prompt
    PlanNode {
        #[command(flatten)]
        flags: ExecutionFlags,

        /// Positional prompt text (optional when --prompt is set)
        #[arg(value_name = "PROMPT")]
        prompt_parts: Vec<String>,
    },
    /// Export a saved session graph to a workflow sidecar
    WorkflowExport {
        #[command(flatten)]
        flags: ExecutionFlags,
    },
    /// Import a workflow sidecar and print graph summary
    WorkflowImport {
        #[command(flatten)]
        flags: ExecutionFlags,
    },
}

#[derive(Subcommand, Debug)]
pub enum PluginCommands {
    List,
    Install {
        source: String,
        #[arg(long)]
        yes: bool,
    },
    Enable {
        id: String,
    },
    Disable {
        id: String,
    },
    Uninstall {
        id: String,
    },
    Doctor {
        #[arg(long)]
        fix: bool,
    },
    Inspect {
        id: String,
    },
    Validate {
        path: String,
    },
}
