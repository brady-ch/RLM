use std::time::Duration;

use async_trait::async_trait;
use futures::StreamExt;
use reqwest::Client;
use serde::Deserialize;
use serde_json::{json, Value};
use thiserror::Error;

use crate::application::execution::CancellationController;
use crate::domain::types::{ChatMessage, LanguageModelResponse, ToolCallRequest};
use crate::ports::{LanguageModel, LanguageModelCompleteOptions};

#[derive(Debug, Error)]
pub enum OllamaLanguageModelError {
    #[error("Ollama chat failed: HTTP {status}")]
    Http { status: u16 },
    #[error("Ollama chat host unavailable: {message}")]
    Unavailable { message: String },
    #[error("Ollama chat response did not include a message")]
    MissingMessage,
    #[error("request failed: {0}")]
    Request(#[from] reqwest::Error),
}

#[derive(Clone)]
pub struct OllamaLanguageModel {
    client: Client,
    base_url: String,
    model: String,
    temperature: f32,
    allow_unconstrained_tool_calls: bool,
    cancel: Option<CancellationController>,
}

impl Default for OllamaLanguageModel {
    fn default() -> Self {
        Self::new(None, None, false)
    }
}

impl OllamaLanguageModel {
    pub fn new(
        base_url: Option<&str>,
        model: Option<&str>,
        allow_unconstrained_tool_calls: bool,
    ) -> Self {
        Self::with_cancellation(base_url, model, allow_unconstrained_tool_calls, None)
    }

    pub fn with_cancellation(
        base_url: Option<&str>,
        model: Option<&str>,
        allow_unconstrained_tool_calls: bool,
        cancel: Option<CancellationController>,
    ) -> Self {
        let client = Client::builder()
            .timeout(Duration::from_secs(120))
            .build()
            .unwrap_or_else(|_| Client::new());
        Self {
            client,
            base_url: base_url
                .unwrap_or("http://127.0.0.1:11434")
                .trim_end_matches('/')
                .to_string(),
            model: model.unwrap_or("granite4.1:3b").to_string(),
            temperature: 0.2,
            allow_unconstrained_tool_calls,
            cancel,
        }
    }

    pub fn model_name(&self) -> &str {
        &self.model
    }

    pub fn base_url(&self) -> &str {
        &self.base_url
    }

    pub async fn health_check(&self) -> Result<(), OllamaLanguageModelError> {
        let url = format!("{}/api/tags", self.base_url);
        self.client
            .get(url)
            .send()
            .await?
            .error_for_status()
            .map_err(|err| {
                if let Some(status) = err.status() {
                    OllamaLanguageModelError::Http {
                        status: status.as_u16(),
                    }
                } else {
                    OllamaLanguageModelError::Unavailable {
                        message: err.to_string(),
                    }
                }
            })?;
        Ok(())
    }

    async fn chat_stream(
        &self,
        messages: &[ChatMessage],
        tools: Option<&[Value]>,
    ) -> Result<LanguageModelResponse, OllamaLanguageModelError> {
        let url = format!("{}/api/chat", self.base_url);
        let mut body = json!({
            "model": self.model,
            "messages": messages.iter().map(chat_message_to_ollama).collect::<Vec<_>>(),
            "stream": true,
            "options": {
                "temperature": self.temperature,
            },
        });
        if let Some(tools) = tools {
            if !tools.is_empty() {
                body["tools"] = json!(tools);
            }
        }

        let response = self.client.post(url).json(&body).send().await?;
        if !response.status().is_success() {
            return Err(OllamaLanguageModelError::Http {
                status: response.status().as_u16(),
            });
        }

        let mut content = String::new();
        let mut tool_calls: Vec<ToolCallRequest> = Vec::new();
        let mut stream = response.bytes_stream();
        let mut buffer = String::new();

        while let Some(chunk) = stream.next().await {
            if self
                .cancel
                .as_ref()
                .is_some_and(CancellationController::is_cancelled)
            {
                return Err(OllamaLanguageModelError::Unavailable {
                    message: "Ollama inference cancelled.".into(),
                });
            }
            let chunk = chunk?;
            buffer.push_str(&String::from_utf8_lossy(&chunk));
            while let Some(line_end) = buffer.find('\n') {
                let line = buffer[..line_end].trim().to_string();
                buffer = buffer[line_end + 1..].to_string();
                if line.is_empty() {
                    continue;
                }
                if let Ok(payload) = serde_json::from_str::<StreamChunk>(&line) {
                    if let Some(message) = payload.message {
                        if let Some(part) = message.content {
                            content.push_str(&part);
                        }
                        if let Some(calls) = message.tool_calls {
                            merge_tool_calls(&mut tool_calls, calls);
                        }
                    }
                }
            }
        }

        Ok(LanguageModelResponse {
            content,
            model: Some(self.model.clone()),
            tool_calls,
        })
    }

    fn build_tool_definitions(options: &LanguageModelCompleteOptions<'_>) -> Vec<Value> {
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

#[derive(Debug, Deserialize)]
struct StreamChunk {
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

fn chat_message_to_ollama(message: &ChatMessage) -> Value {
    json!({
        "role": message.role,
        "content": message.content,
    })
}

fn merge_tool_calls(target: &mut Vec<ToolCallRequest>, incoming: Vec<OllamaToolCall>) {
    for call in incoming {
        let Some(function) = call.function else {
            continue;
        };
        let Some(name) = function.name.filter(|name| !name.is_empty()) else {
            continue;
        };
        target.push(ToolCallRequest {
            name,
            arguments: function.arguments.unwrap_or_else(|| json!({})),
        });
    }
}

#[async_trait]
impl LanguageModel for OllamaLanguageModel {
    fn model_label(&self) -> Option<&str> {
        Some(self.model_name())
    }

    async fn complete(
        &self,
        messages: &[ChatMessage],
        options: LanguageModelCompleteOptions<'_>,
    ) -> LanguageModelResponse {
        let tools = if options.tools_enabled && !options.tools.is_empty() {
            Some(Self::build_tool_definitions(&options))
        } else {
            None
        };

        let constrained = options.constrained_tool_calling
            && !self.allow_unconstrained_tool_calls
            && tools.as_ref().is_some_and(|t| !t.is_empty());

        let result = if constrained {
            let first = self.chat_stream(messages, None).await;
            match first {
                Ok(first_response) => {
                    if !first_response.tool_calls.is_empty() || first_response.content.is_empty() {
                        let mut extended = messages.to_vec();
                        if !first_response.content.is_empty() {
                            extended.push(ChatMessage {
                                role: "assistant".into(),
                                content: first_response.content.clone(),
                            });
                        }
                        match self.chat_stream(&extended, tools.as_deref()).await {
                            Ok(second) => Ok(second),
                            Err(_) => Ok(first_response),
                        }
                    } else {
                        Ok(first_response)
                    }
                }
                Err(err) => Err(err),
            }
        } else {
            self.chat_stream(messages, tools.as_deref()).await
        };

        match result {
            Ok(response) => response,
            Err(err) => LanguageModelResponse {
                content: format!("Ollama inference failed: {err}"),
                model: Some(self.model.clone()),
                tool_calls: Vec::new(),
            },
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::ports::LanguageModelToolDefinition;

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
}
