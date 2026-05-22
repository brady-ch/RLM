use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ModelLibraryEntry {
    pub id: String,
    pub label: String,
    pub source: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ollama_model: Option<String>,
    pub description: String,
    pub tags: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub estimated_ram_mb: Option<u32>,
    pub status: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reason: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ModelInstallJob {
    pub id: String,
    pub model: String,
    pub status: String,
    pub progress: f32,
    pub message: String,
    pub started_at: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub completed_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ModelLibrarySnapshot {
    pub curated: Vec<ModelLibraryEntry>,
    pub installed: Vec<ModelLibraryEntry>,
    pub jobs: Vec<ModelInstallJob>,
    pub tiers: std::collections::HashMap<String, String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ModelLibrarySearchResult {
    pub query: String,
    pub results: Vec<ModelLibraryEntry>,
}

pub const CURATED_MODELS: &[(&str, &str, &str, u32, &[&str])] = &[
    (
        "granite4.1:3b",
        "Granite 4.1 3B",
        "Small default model for routing, classification, and quick local answers.",
        4096,
        &["small", "default", "routing"],
    ),
    (
        "llama3.1:8b",
        "Llama 3.1 8B",
        "Balanced general-purpose local model for answer and synthesis work.",
        8192,
        &["balanced", "general", "synthesis"],
    ),
    (
        "qwen2.5-coder:14b",
        "Qwen2.5 Coder 14B",
        "Larger coding-oriented model for complex implementation and review tasks.",
        16000,
        &["large", "coding", "review"],
    ),
];
