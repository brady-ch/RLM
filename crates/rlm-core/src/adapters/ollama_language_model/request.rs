use serde_json::{json, Value};

use crate::domain::types::ChatMessage;
use crate::ports::LanguageModelCompleteOptions;

use super::OllamaLanguageModel;

pub(super) fn chat_message_to_ollama(message: &ChatMessage) -> Value {
    let mut payload = json!({
        "role": message.role,
        "content": message.content,
    });
    if let Some(tool_call_id) = &message.tool_call_id {
        payload["tool_call_id"] = json!(tool_call_id);
    }
    if let Some(tool_calls) = &message.tool_calls {
        payload["tool_calls"] = json!(tool_calls
            .iter()
            .map(|call| json!({
                "function": {
                    "name": call.name,
                    "arguments": call.arguments,
                }
            }))
            .collect::<Vec<_>>());
    }
    payload
}

impl OllamaLanguageModel {
    pub(super) fn build_chat_body(
        &self,
        messages: &[ChatMessage],
        tools: Option<&[Value]>,
        format: Option<&Value>,
        temperature: Option<f32>,
    ) -> Value {
        let temp = temperature.unwrap_or(self.temperature);
        let mut body = json!({
            "model": self.model,
            "messages": messages.iter().map(chat_message_to_ollama).collect::<Vec<_>>(),
            "stream": true,
            "keep_alive": 0,
            "options": {
                "temperature": temp,
            },
        });
        if let Some(format) = format {
            body["format"] = format.clone();
        } else if let Some(tools) = tools {
            if !tools.is_empty() {
                body["tools"] = json!(tools);
            }
        }
        body
    }

    pub(super) fn build_tool_definitions(options: &LanguageModelCompleteOptions<'_>) -> Vec<Value> {
        options
            .tools
            .iter()
            .map(|tool| {
                json!({
                    "type": "function",
                    "function": {
                        "name": tool.name,
                        "description": tool.description,
                        "parameters": tool.schema,
                    }
                })
            })
            .collect()
    }
}
