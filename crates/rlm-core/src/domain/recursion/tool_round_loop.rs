use std::sync::Arc;

use async_trait::async_trait;

use crate::domain::recursion::{
    can_spend_any_model_call, fallback_from_messages, max_tool_rounds_from_limit,
    parse_clarification_request, preview, to_model_purpose,
};
use crate::domain::types::{
    ChatMessage, ExecutionStatusUpdateDetail, TaskNode, ToolCallRecord, ToolCallRequest,
};
use crate::ports::{
    LanguageModel, LanguageModelCompleteOptions, LanguageModelToolDefinition, Tool,
    ToolExecutionResult,
};

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
    fn append_tool_call_record(&self, record: ToolCallRecord);
    fn mark_execution_node_failed(
        &self,
        node_id: &str,
        status: &str,
        detail: Option<ExecutionStatusUpdateDetail>,
    );
    fn tools_for_task(&self, task: &TaskNode) -> Vec<Arc<dyn Tool>>;
    fn get_tool_by_name(&self, name: &str) -> Option<Arc<dyn Tool>>;
    async fn resolve_memory_packet(&self, task: &TaskNode) -> Option<String>;
    async fn request_clarification(
        &self,
        task: &TaskNode,
        prompt_text: &str,
    ) -> Result<String, String>;
    fn model(&self) -> &dyn LanguageModel;
    fn with_agent_system_prompt(&self, messages: Vec<ChatMessage>) -> Vec<ChatMessage>;
}

fn tool_definitions(tools: &[Arc<dyn Tool>]) -> Vec<LanguageModelToolDefinition> {
    tools
        .iter()
        .map(|tool| LanguageModelToolDefinition {
            name: tool.name().to_string(),
            description: tool.description().to_string(),
            schema: tool.schema(),
        })
        .collect()
}

fn assign_tool_call_ids(calls: Vec<ToolCallRequest>) -> Vec<ToolCallRequest> {
    calls
        .into_iter()
        .enumerate()
        .map(|(index, mut call)| {
            if call.id.is_none() {
                call.id = Some(format!("tool-call-{}", index + 1));
            }
            call
        })
        .collect()
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

    let memory_packet = host.resolve_memory_packet(task).await;
    let mut conversation = if let Some(text) = memory_packet {
        let mut prefixed = vec![ChatMessage::text("system", text)];
        prefixed.extend(messages);
        prefixed
    } else {
        messages
    };

    let tool_round_limit = host.get_tool_round_limit();
    for round in 0..=max_tool_rounds_from_limit(tool_round_limit as i32) {
        host.consume_model_call();
        let purpose = to_model_purpose(kind);
        let tools = if allow_tools {
            host.tools_for_task(task)
        } else {
            Vec::new()
        };
        let tools_enabled = allow_tools && !tools.is_empty();
        let tool_definitions = tool_definitions(&tools);
        let response = host
            .model()
            .complete(
                &host.with_agent_system_prompt(conversation.clone()),
                LanguageModelCompleteOptions {
                    purpose,
                    tools_enabled,
                    tools: tool_definitions,
                    constrained_tool_calling: tools_enabled,
                },
            )
            .await;

        let tool_calls = assign_tool_call_ids(response.tool_calls);

        if tool_calls.is_empty() {
            if let Some(clarify) = parse_clarification_request(&response.content) {
                let answer = host.request_clarification(task, &clarify).await?;
                conversation.push(ChatMessage::text("assistant", response.content));
                conversation.push(ChatMessage::text("user", answer));
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
            if !response.content.is_empty() {
                return Ok(response.content);
            }

            return if can_spend_any_model_call(host.get_model_calls(), host.get_max_model_calls()) {
                run_completion_without_tools(
                    host,
                    task,
                    kind,
                    vec![
                        conversation,
                        vec![
                            ChatMessage {
                                role: "assistant".into(),
                                content: response.content.clone(),
                                tool_call_id: None,
                                tool_calls: Some(tool_calls),
                            },
                            ChatMessage::text(
                                "system",
                                "Tool use is no longer available. Answer directly from the conversation and tool context already present.",
                            ),
                        ],
                    ]
                    .concat(),
                )
                .await
            } else {
                Ok(fallback_from_messages(&conversation))
            };
        }

        conversation.push(ChatMessage {
            role: "assistant".into(),
            content: response.content.clone(),
            tool_call_id: None,
            tool_calls: Some(tool_calls.clone()),
        });

        for tool_call in tool_calls {
            let result = execute_tool(host, task, kind, &tool_call).await;
            conversation.push(ChatMessage {
                role: "tool".into(),
                content: result.content.clone(),
                tool_call_id: tool_call.id.clone(),
                tool_calls: None,
            });
        }

        if !can_spend_any_model_call(host.get_model_calls(), host.get_max_model_calls()) {
            host.record_limit(
                task,
                &format!("model call budget reached after tool calls during {kind}"),
            );
            return Ok(if response.content.is_empty() {
                fallback_from_messages(&conversation)
            } else {
                response.content
            });
        }
    }

    host.record_limit(task, &format!("tool round limit reached during {kind}"));
    Ok(fallback_from_messages(&conversation))
}

async fn execute_tool(
    host: &dyn ModelCompletionHost,
    task: &TaskNode,
    kind: &str,
    tool_call: &ToolCallRequest,
) -> ToolExecutionResult {
    let tool_call_id = tool_call
        .id
        .clone()
        .unwrap_or_else(|| format!("tool-call-{}", tool_call.name));

    host.throw_if_cancelled(task).ok();
    host.record(
        task,
        "tool-call",
        &serde_json::to_string(&tool_call.arguments).unwrap_or_default(),
        &tool_call.name,
    );

    let Some(tool) = host.get_tool_by_name(&tool_call.name) else {
        let msg = format!("Unknown tool: {}", tool_call.name);
        host.record(task, "error", &task.prompt, &msg);
        host.append_tool_call_record(ToolCallRecord {
            id: tool_call_id,
            name: tool_call.name.clone(),
            args: tool_call.arguments.clone(),
            status: "error".into(),
            output: msg.clone(),
        });
        return ToolExecutionResult {
            content: msg,
            is_error: true,
        };
    };

    let result = tool.execute(tool_call.arguments.clone()).await;
    let status = if result.is_error { "error" } else { "success" };

    host.append_tool_call_record(ToolCallRecord {
        id: tool_call_id.clone(),
        name: tool_call.name.clone(),
        args: tool_call.arguments.clone(),
        status: status.into(),
        output: result.content.clone(),
    });

    host.record(
        task,
        if result.is_error { "error" } else { "tool-result" },
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
        host.mark_execution_node_failed(
            &task.id,
            "failed",
            Some(ExecutionStatusUpdateDetail {
                failure_category: Some("tool".into()),
                code: Some("tool".into()),
                message: Some(result.content.clone()),
            }),
        );
    }

    result
}

pub async fn run_completion_without_tools(
    host: &dyn ModelCompletionHost,
    task: &TaskNode,
    kind: &str,
    messages: Vec<ChatMessage>,
) -> Result<String, String> {
    if !can_spend_any_model_call(host.get_model_calls(), host.get_max_model_calls()) {
        host.record_limit(
            task,
            &format!("model call budget reached before direct {kind} follow-up"),
        );
        return Ok(fallback_from_messages(&messages));
    }

    host.consume_model_call();
    let purpose = to_model_purpose(kind);
    let response = host
        .model()
        .complete(
            &host.with_agent_system_prompt(messages.clone()),
            LanguageModelCompleteOptions {
                purpose,
                tools_enabled: false,
                tools: Vec::new(),
                constrained_tool_calling: false,
            },
        )
        .await;

    if !response.tool_calls.is_empty() {
        host.record_limit(
            task,
            &format!("ignored tool requests during direct {kind} follow-up"),
        );
    }

    Ok(if response.content.is_empty() {
        fallback_from_messages(&messages)
    } else {
        response.content
    })
}

#[cfg(test)]
#[path = "../../../tests/domain/recursion/tool_round_loop.rs"]
mod tool_round_loop_tests;
