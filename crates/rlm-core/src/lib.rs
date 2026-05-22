pub mod adapters;
pub mod application;
pub mod control_server;
pub mod domain;
pub mod interop;
pub mod model_library;
pub mod persistence;
pub mod plugins;
pub mod ports;
pub mod server;

pub use adapters::OllamaLanguageModel;
pub use application::bootstrap::{
    apply_config_overrides, prepare_ask_execution, prepare_cli_runtime, CliAskRuntime,
    CliConfigOverrides, CliRuntime,
};
pub use control_server::state;
pub use domain::RecursiveLanguageModel;
pub use application::execution::InteractiveExecutionSession;
pub use application::memory::{SemanticMemoryIndex, VectorIndexStatus};
pub use model_library::ModelLibraryService;
pub use persistence::{
    load_project_config, AnnVectorIndex, FileMemoryStore, FileRunStateStore, FileSessionStore,
    FileVectorIndex, LoadedProjectConfig, MemoryInspectionSnapshot, ProjectPaths,
    VectorIndexRecord,
};
pub use plugins::{build_runtime_context, PluginRegistryService, RuntimeContext};
pub use ports::{InMemoryTrace, LanguageModelCompleteOptions, QueueModel};
pub use application::graph::{
    default_save_variant, execute_graph, export_and_save_graph_workflow,
    import_sidecar_to_graph, load_graph_workflow, GraphExecutorInput,
};
pub use server::{start_server, ControlServer, ServerConfig};

// Crate-root facades preserving rlm_core::execution, ::graph, ::memory, ::bootstrap paths.
pub use application::{bootstrap, execution, graph, memory};
