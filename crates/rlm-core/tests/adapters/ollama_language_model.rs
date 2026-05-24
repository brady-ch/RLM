use super::*;
use crate::adapters::ollama_language_model::response::map_envelope_content_for_test;
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
        response_format: None,
    };
    let defs = OllamaLanguageModel::build_tool_definitions(&options);
    assert_eq!(defs.len(), 1);
    assert_eq!(defs[0]["function"]["name"], "shell");
}

#[test]
fn chat_request_unloads_model_after_response() {
    let model = OllamaLanguageModel::new(None, Some("llama3.1:8b"), false, false);
    let body = model.build_chat_body(&[ChatMessage::text("user", "hello")], None, None, None);

    assert_eq!(body["model"], "llama3.1:8b");
    assert_eq!(body["keep_alive"], 0);
}

#[test]
fn chat_request_uses_format_without_tools_when_both_provided() {
    let model = OllamaLanguageModel::new(None, Some("llama3.1:8b"), false, false);
    let tools = vec![json!({"type": "function"})];
    let format = json!({"type": "object"});
    let body = model.build_chat_body(
        &[ChatMessage::text("user", "hello")],
        Some(&tools),
        Some(&format),
        None,
    );

    assert!(body.get("format").is_some());
    assert!(body.get("tools").is_none());
}

#[test]
fn chat_request_uses_tools_when_format_absent() {
    let model = OllamaLanguageModel::new(None, Some("llama3.1:8b"), false, false);
    let tools = vec![json!({"type": "function"})];
    let body = model.build_chat_body(
        &[ChatMessage::text("user", "hello")],
        Some(&tools),
        None,
        None,
    );

    assert!(body.get("tools").is_some());
    assert!(body.get("format").is_none());
}

#[test]
fn map_envelope_final_to_content() {
    let tools = vec![LanguageModelToolDefinition {
        name: "shell".into(),
        description: "Run shell".into(),
        schema: json!({"type": "object"}),
    }];
    let response = map_envelope_content_for_test(
        r#"{"choice":{"kind":"final","final":"done"}}"#,
        &tools,
    );
    assert_eq!(response.content, "done");
    assert!(response.tool_calls.is_empty());
}

#[test]
fn map_envelope_tool_call_to_tool_calls() {
    let tools = vec![LanguageModelToolDefinition {
        name: "shell".into(),
        description: "Run shell".into(),
        schema: json!({"type": "object"}),
    }];
    let response = map_envelope_content_for_test(
        r#"{"choice":{"kind":"tool_call","tool":"shell","args":{"command":"ls"}}}"#,
        &tools,
    );
    assert!(response.content.is_empty());
    assert_eq!(response.tool_calls.len(), 1);
    assert_eq!(response.tool_calls[0].name, "shell");
}

#[test]
fn map_envelope_unknown_tool_returns_error_content() {
    let tools = vec![LanguageModelToolDefinition {
        name: "shell".into(),
        description: "Run shell".into(),
        schema: json!({"type": "object"}),
    }];
    let response = map_envelope_content_for_test(
        r#"{"choice":{"kind":"tool_call","tool":"evil","args":{}}}"#,
        &tools,
    );
    assert!(response.content.contains("unknown tool"));
    assert!(response.tool_calls.is_empty());
}
