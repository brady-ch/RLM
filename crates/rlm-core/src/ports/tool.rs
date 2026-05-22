use async_trait::async_trait;

use crate::domain::types::ToolExecutionResult;

#[async_trait]
pub trait Tool: Send + Sync {
    fn name(&self) -> &str;
    async fn execute(&self, arguments: serde_json::Value) -> ToolExecutionResult;
}

pub struct EchoTool {
    name: String,
}

impl EchoTool {
    pub fn new(name: impl Into<String>) -> Self {
        Self { name: name.into() }
    }
}

#[async_trait]
impl Tool for EchoTool {
    fn name(&self) -> &str {
        &self.name
    }

    async fn execute(&self, arguments: serde_json::Value) -> ToolExecutionResult {
        ToolExecutionResult {
            content: arguments.to_string(),
            is_error: false,
        }
    }
}
