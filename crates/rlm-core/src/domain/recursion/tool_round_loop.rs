use std::sync::Arc;

use async_trait::async_trait;

use crate::domain::recursion::{
    can_spend_any_model_call, fallback_from_messages, max_tool_rounds_from_limit,
    parse_clarification_request, preview, to_model_purpose,
};
use crate::domain::types::{ChatMessage, ExecutionStatusUpdateDetail, TaskNode, ToolCallRequest};
use crate::ports::{LanguageModel, Tool};

#[async_trait]
pub trait ModelCompletionHost: Send + Sync {
    fn get_model_calls(&self) -> u32;
    fn get_max_model_calls(&self) -> u32;
    fn get_tool_round_limit(&self) -> u32;
    fn consume_model_call(&self);
    fn throw_if_cancelled(&self, task: &TaskNode) -> Result<(), String>;
    fn record_limit(&self, task: &TaskNode, message: &str);
    fn record(&self, task: &TaskNode, kind: &str, prompt: &str, output: &str);
    fn push_metadata_error(&self, message: &str);
    fn mark_execution_node_failed(
        &self,
        node_id: &str,
        status: &str,
        detail: Option<ExecutionStatusUpdateDetail>,
    );
    fn tools_for_task(&self, task: &TaskNode) -> Vec<Arc<dyn Tool>>;
    fn get_tool_by_name(&self, name: &str) -> Option<Arc<dyn Tool>>;
    async fn request_clarification(
        &self,
        task: &TaskNode,
        prompt_text: &str,
    ) -> Result<String, String>;
    fn model(&self) -> &dyn LanguageModel;
    fn with_agent_system_prompt(&self, messages: Vec<ChatMessage>) -> Vec<ChatMessage>;
}

pub async fn run_completion_with_tool_rounds(
    host: &dyn ModelCompletionHost,
    task: &TaskNode,
    kind: &str,
    messages: Vec<ChatMessage>,
    allow_tools: bool,
) -> Result<String, String> {
    host.throw_if_cancelled(task)?;
    if !can_spend_any_model_call(host.get_model_calls(), host.get_max_model_calls()) {
        host.record_limit(task, &format!("model call budget reached before {kind}"));
        return Ok(fallback_from_messages(&messages));
    }

    let mut conversation = messages;
    let tool_round_limit = host.get_tool_round_limit();
    for round in 0..=max_tool_rounds_from_limit(tool_round_limit as i32) {
        host.consume_model_call();
        let purpose = to_model_purpose(kind);
        let response = host
            .model()
            .complete(
                &host.with_agent_system_prompt(conversation.clone()),
                purpose,
                allow_tools && !host.tools_for_task(task).is_empty(),
            )
            .await;

        if response.tool_calls.is_empty() {
            if let Some(clarify) = parse_clarification_request(&response.content) {
                let answer = host.request_clarification(task, &clarify).await?;
                conversation.push(ChatMessage {
                    role: "assistant".into(),
                    content: response.content,
                });
                conversation.push(ChatMessage {
                    role: "user".into(),
                    content: answer,
                });
                continue;
            }
            return Ok(response.content);
        }

        if !allow_tools {
            let output = format!(
                "Model requested tools during {kind}, but tools are disabled for this step."
            );
            host.record(task, "error", &task.prompt, &output);
            host.push_metadata_error(&output);
            host.mark_execution_node_failed(
                &task.id,
                "failed",
                Some(ExecutionStatusUpdateDetail {
                    failure_category: Some("model".into()),
                    code: Some("model".into()),
                    message: Some(output.clone()),
                }),
            );
            return Ok(if response.content.is_empty() {
                fallback_from_messages(&conversation)
            } else {
                response.content
            });
        }

        if round >= max_tool_rounds_from_limit(tool_round_limit as i32) {
            host.record_limit(task, &format!("tool round limit reached during {kind}"));
            return Ok(if response.content.is_empty() {
                fallback_from_messages(&conversation)
            } else {
                response.content
            });
        }

        conversation.push(ChatMessage {
            role: "assistant".into(),
            content: response.content.clone(),
        });

        for tool_call in response.tool_calls {
            let result = execute_tool(host, task, kind, &tool_call).await;
            conversation.push(ChatMessage {
                role: "user".into(),
                content: format!("Tool {} result: {}", tool_call.name, result),
            });
        }
    }

    Ok(fallback_from_messages(&conversation))
}

async fn execute_tool(
    host: &dyn ModelCompletionHost,
    task: &TaskNode,
    kind: &str,
    tool_call: &ToolCallRequest,
) -> String {
    let Some(tool) = host.get_tool_by_name(&tool_call.name) else {
        let msg = format!("Unknown tool: {}", tool_call.name);
        host.record(task, "error", &task.prompt, &msg);
        return msg;
    };
    let result = tool.execute(tool_call.arguments.clone()).await;
    host.record(
        task,
        if result.is_error {
            "error"
        } else {
            "tool-result"
        },
        &format!(
            "{} ({})",
            tool_call.name,
            preview(&tool_call.arguments.to_string(), 120)
        ),
        &result.content,
    );
    if result.is_error {
        let msg = format!(
            "Tool {} failed during {kind}: {}",
            tool_call.name, result.content
        );
        host.push_metadata_error(&msg);
    }
    result.content
}

pub async fn run_completion_without_tools(
    host: &dyn ModelCompletionHost,
    task: &TaskNode,
    kind: &str,
    messages: Vec<ChatMessage>,
) -> Result<String, String> {
    run_completion_with_tool_rounds(host, task, kind, messages, false).await
}
