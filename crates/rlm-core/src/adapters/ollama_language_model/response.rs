use serde::Deserialize;
use serde_json::{Value, json};

use crate::domain::types::ToolCallRequest;

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
