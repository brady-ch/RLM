use super::*;
use crate::ports::LanguageModelToolDefinition;
use serde_json::json;

#[test]
fn default_uses_local_ollama_defaults() {
    let model = OllamaLanguageModel::default();
    assert_eq!(model.base_url(), "http://127.0.0.1:11434");
    assert_eq!(model.model_name(), "granite4.1:3b");
}

#[test]
fn builds_tool_definitions_from_options() {
    let options = LanguageModelCompleteOptions {
        purpose: Some("answer"),
        tools_enabled: true,
        tools: vec![LanguageModelToolDefinition {
            name: "shell".into(),
            description: "Run shell".into(),
            schema: json!({"type": "object"}),
        }],
        constrained_tool_calling: true,
    };
    let defs = OllamaLanguageModel::build_tool_definitions(&options);
    assert_eq!(defs.len(), 1);
    assert_eq!(defs[0]["function"]["name"], "shell");
}

#[test]
fn chat_request_unloads_model_after_response() {
    let model = OllamaLanguageModel::new(None, Some("llama3.1:8b"), false);
    let body = model.build_chat_body(&[ChatMessage::text("user", "hello")], None);

    assert_eq!(body["model"], "llama3.1:8b");
    assert_eq!(body["keep_alive"], 0);
}
