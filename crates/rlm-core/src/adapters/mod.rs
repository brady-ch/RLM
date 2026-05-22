pub mod ollama_embedding;
pub mod ollama_language_model;

pub use ollama_embedding::{EmbeddingError, OllamaEmbeddingModel};
pub use ollama_language_model::{OllamaLanguageModel, OllamaLanguageModelError};
