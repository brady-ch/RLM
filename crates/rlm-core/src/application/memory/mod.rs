pub mod ram_guard;
pub mod semantic_memory_index;
pub mod session_memory_bridge;

pub use ram_guard::{
    assert_model_ram_eligible, assert_model_ram_eligible_async, assert_runtime_ram_eligible,
    assert_runtime_ram_eligible_async, available_model_ram_mb, current_free_ram_mb,
    estimate_model_ram_mb, is_wsl, model_ram_eligibility, ollama_loaded_ram_mb, peak_runtime_model_ram_mb,
    ram_snapshot, resource_guard_json, ModelRamEligibility, RamSnapshot,
};
pub use semantic_memory_index::{SemanticMemoryIndex, VectorIndexStatus};
pub use session_memory_bridge::{
    build_saved_session_payload, build_saved_vector_index_section, merge_session_vector_records,
    read_run_id_from_payload, restore_graph_workflow_metadata, restore_session_memory,
};
