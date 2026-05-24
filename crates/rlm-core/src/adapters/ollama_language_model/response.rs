use serde::Deserialize;
use serde_json::{json, Value};

use crate::domain::recursion::{parse_envelope_response, EnvelopeError, ParsedEnvelope};
use crate::domain::types::{LanguageModelResponse, ToolCallRequest};
use crate::ports::LanguageModelToolDefinition;

#[derive(Debug, Deserialize)]
pub(super) struct StreamChunk {
    message: Option<StreamMessage>,
}

#[derive(Debug, Deserialize)]
struct StreamMessage {
    content: Option<String>,
    tool_calls: Option<Vec<OllamaToolCall>>,
}

#[derive(Debug, Deserialize)]
struct OllamaToolCall {
    function: Option<OllamaFunctionCall>,
}

#[derive(Debug, Deserialize)]
struct OllamaFunctionCall {
    name: Option<String>,
    arguments: Option<Value>,
}

pub(super) fn apply_stream_line(
    line: &str,
    content: &mut String,
    tool_calls: &mut Vec<ToolCallRequest>,
) {
    if line.is_empty() {
        return;
    }
    if let Ok(payload) = serde_json::from_str::<StreamChunk>(line) {
        if let Some(message) = payload.message {
            if let Some(part) = message.content {
                content.push_str(&part);
            }
            if let Some(calls) = message.tool_calls {
                merge_tool_calls(tool_calls, calls);
            }
        }
    }
}

fn merge_tool_calls(target: &mut Vec<ToolCallRequest>, incoming: Vec<OllamaToolCall>) {
    for (index, call) in incoming.into_iter().enumerate() {
        let Some(function) = call.function else {
            continue;
        };
        let Some(name) = function.name.filter(|name| !name.is_empty()) else {
            continue;
        };
        target.push(ToolCallRequest {
            id: Some(format!("tool-call-{}", target.len() + index + 1)),
            name,
            arguments: function.arguments.unwrap_or_else(|| json!({})),
        });
    }
}

pub(super) fn map_envelope_content(
    content: &str,
    allowed_tools: &[LanguageModelToolDefinition],
    model: &str,
) -> LanguageModelResponse {
    match parse_envelope_response(content, allowed_tools) {
        Ok(ParsedEnvelope::Final(text)) => LanguageModelResponse {
            content: text,
            model: Some(model.to_string()),
            tool_calls: Vec::new(),
        },
        Ok(ParsedEnvelope::ToolCall { name, args }) => LanguageModelResponse {
            content: String::new(),
            model: Some(model.to_string()),
            tool_calls: vec![ToolCallRequest {
                id: Some("tool-call-1".into()),
                name,
                arguments: args,
            }],
        },
        Err(err) => LanguageModelResponse {
            content: envelope_error_message(&err),
            model: Some(model.to_string()),
            tool_calls: Vec::new(),
        },
    }
}

fn envelope_error_message(err: &EnvelopeError) -> String {
    format!("Ollama envelope parse failed: {err}")
}

#[cfg(test)]
pub(super) fn map_envelope_content_for_test(
    content: &str,
    allowed_tools: &[LanguageModelToolDefinition],
) -> LanguageModelResponse {
    map_envelope_content(content, allowed_tools, "test-model")
}
