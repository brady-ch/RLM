pub mod ask;
pub mod plugin;
pub mod ui;

use std::path::PathBuf;

use clap::Subcommand;

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
    },
    /// Run a one-shot prompt (stub — use RLM_RUNTIME=node for full execution)
    Ask {
        /// Prompt text
        prompt: Vec<String>,
    },
    /// Plugin registry administration
    Plugin {
        #[command(subcommand)]
        sub: PluginCommands,
    },
    /// Plan a node subgraph (not yet implemented in Rust)
    PlanNode {
        #[arg(long)]
        node_id: Option<String>,
    },
    /// Export workflow sidecar (not yet implemented in Rust)
    WorkflowExport,
    /// Import workflow sidecar (not yet implemented in Rust)
    WorkflowImport,
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

pub fn not_implemented(command: &str) -> ! {
    eprintln!(
        "{command} is not yet implemented in the Rust CLI. \
         Use RLM_RUNTIME=node for full execution during migration."
    );
    std::process::exit(2);
}
