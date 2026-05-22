use async_trait::async_trait;

use crate::domain::types::{ChatMessage, LanguageModelResponse, ToolCallRequest};

#[async_trait]
pub trait LanguageModel: Send + Sync {
    async fn complete(
        &self,
        messages: &[ChatMessage],
        purpose: Option<&str>,
        tools_enabled: bool,
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
        _purpose: Option<&str>,
        _tools_enabled: bool,
    ) -> LanguageModelResponse {
        let mut queue = self.responses.lock().await;
        queue.pop().unwrap_or(LanguageModelResponse {
            content: String::new(),
            model: Some("mock".into()),
            tool_calls: Vec::new(),
        })
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
        _purpose: Option<&str>,
        tools_enabled: bool,
    ) -> LanguageModelResponse {
        let mut called = self.called.lock().await;
        if tools_enabled && !*called {
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
