use super::*;

#[test]
fn default_uses_local_ollama_defaults() {
    let model = OllamaEmbeddingModel::default();
    assert_eq!(model.base_url, "http://127.0.0.1:11434");
    assert_eq!(model.model, "nomic-embed-text");
}
