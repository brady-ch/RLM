use async_trait::async_trait;

use crate::domain::types::{ChatMessage, LanguageModelResponse, ToolCallRequest};

#[derive(Debug, Clone, Default)]
pub struct LanguageModelToolDefinition {
    pub name: String,
    pub description: String,
    pub schema: serde_json::Value,
}

#[derive(Debug, Clone)]
pub struct LanguageModelCompleteOptions<'a> {
    pub purpose: Option<&'a str>,
    pub tools_enabled: bool,
    pub tools: Vec<LanguageModelToolDefinition>,
    pub constrained_tool_calling: bool,
}

impl<'a> LanguageModelCompleteOptions<'a> {
    pub fn simple(purpose: Option<&'a str>, tools_enabled: bool) -> Self {
        Self {
            purpose,
            tools_enabled,
            tools: Vec::new(),
            constrained_tool_calling: false,
        }
    }
}

#[async_trait]
pub trait LanguageModel: Send + Sync {
    async fn complete(
        &self,
        messages: &[ChatMessage],
        options: LanguageModelCompleteOptions<'_>,
    ) -> LanguageModelResponse;
}

/// Deterministic queue model for tests — pops responses in order.
pub struct QueueModel {
    responses: tokio::sync::Mutex<Vec<LanguageModelResponse>>,
}

impl QueueModel {
    pub fn new(contents: impl IntoIterator<Item = impl Into<String>>) -> Self {
        Self {
            responses: tokio::sync::Mutex::new(
                contents
                    .into_iter()
                    .map(|c| LanguageModelResponse {
                        content: c.into(),
                        model: Some("mock".into()),
                        tool_calls: Vec::new(),
                    })
                    .collect(),
            ),
        }
    }
}

#[async_trait]
impl LanguageModel for QueueModel {
    async fn complete(
        &self,
        _messages: &[ChatMessage],
        _options: LanguageModelCompleteOptions<'_>,
    ) -> LanguageModelResponse {
        let mut queue = self.responses.lock().await;
        if queue.is_empty() {
            LanguageModelResponse {
                content: String::new(),
                model: Some("mock".into()),
                tool_calls: Vec::new(),
            }
        } else {
            queue.remove(0)
        }
    }
}

/// Model that returns tool calls then final content.
pub struct ToolRoundModel {
    tool_name: String,
    final_content: String,
    called: tokio::sync::Mutex<bool>,
}

impl ToolRoundModel {
    pub fn new(tool_name: impl Into<String>, final_content: impl Into<String>) -> Self {
        Self {
            tool_name: tool_name.into(),
            final_content: final_content.into(),
            called: tokio::sync::Mutex::new(false),
        }
    }
}

#[async_trait]
impl LanguageModel for ToolRoundModel {
    async fn complete(
        &self,
        _messages: &[ChatMessage],
        options: LanguageModelCompleteOptions<'_>,
    ) -> LanguageModelResponse {
        let mut called = self.called.lock().await;
        if options.tools_enabled && !*called {
            *called = true;
            LanguageModelResponse {
                content: String::new(),
                model: Some("mock".into()),
                tool_calls: vec![ToolCallRequest {
                    name: self.tool_name.clone(),
                    arguments: serde_json::json!({}),
                }],
            }
        } else {
            LanguageModelResponse {
                content: self.final_content.clone(),
                model: Some("mock".into()),
                tool_calls: Vec::new(),
            }
        }
    }
}
