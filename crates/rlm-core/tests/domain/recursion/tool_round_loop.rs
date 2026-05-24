use std::collections::HashMap;
use std::sync::{Arc, Mutex};

use async_trait::async_trait;

use super::*;
use crate::domain::types::{
    ChatMessage, ExecutionStatusUpdateDetail, LanguageModelResponse, TaskNode, ToolCallRecord,
};
use crate::ports::{
    EchoTool, LanguageModel, LanguageModelCompleteOptions, LanguageModelToolDefinition, Tool,
    ToolRoundModel,
};

struct TestHost {
    model: Arc<dyn LanguageModel>,
    tools: HashMap<String, Arc<dyn Tool>>,
    model_calls: Mutex<u32>,
    max_model_calls: u32,
    tool_round_limit: u32,
    records: Mutex<Vec<ToolCallRecord>>,
}

#[async_trait]
impl ModelCompletionHost for TestHost {
    fn get_model_calls(&self) -> u32 {
        *self.model_calls.lock().expect("lock")
    }

    fn get_max_model_calls(&self) -> u32 {
        self.max_model_calls
    }

    fn get_tool_round_limit(&self) -> u32 {
        self.tool_round_limit
    }

    fn consume_model_call(&self) {
        *self.model_calls.lock().expect("lock") += 1;
    }

    fn throw_if_cancelled(&self, _task: &TaskNode) -> Result<(), String> {
        Ok(())
    }

    fn record_limit(&self, _task: &TaskNode, _message: &str) {}

    fn record(&self, _task: &TaskNode, _kind: &str, _prompt: &str, _output: &str) {}

    fn push_metadata_error(&self, _message: &str) {}

    fn append_tool_call_record(&self, record: ToolCallRecord) {
        self.records.lock().expect("lock").push(record);
    }

    fn mark_execution_node_failed(
        &self,
        _node_id: &str,
        _status: &str,
        _detail: Option<ExecutionStatusUpdateDetail>,
    ) {
    }

    fn tools_for_task(&self, _task: &TaskNode) -> Vec<Arc<dyn Tool>> {
        self.tools.values().cloned().collect()
    }

    fn get_tool_by_name(&self, name: &str) -> Option<Arc<dyn Tool>> {
        self.tools.get(name).cloned()
    }

    async fn resolve_memory_packet(&self, _task: &TaskNode) -> Option<String> {
        None
    }

    async fn request_clarification(
        &self,
        _task: &TaskNode,
        _prompt_text: &str,
    ) -> Result<String, String> {
        Ok(String::new())
    }

    fn model(&self) -> &dyn LanguageModel {
        self.model.as_ref()
    }

    fn with_agent_system_prompt(&self, messages: Vec<ChatMessage>) -> Vec<ChatMessage> {
        messages
    }
}

fn test_task() -> TaskNode {
    TaskNode {
        id: "task-1".into(),
        parent_id: None,
        prompt: "test".into(),
        depth: 0,
        kind: None,
        model_override: None,
        context_policy: None,
    }
}

#[tokio::test]
async fn executes_tool_round_and_records_result() {
    let echo = Arc::new(EchoTool::new("echo")) as Arc<dyn Tool>;
    let mut tools = HashMap::new();
    tools.insert("echo".into(), Arc::clone(&echo));
    let host = TestHost {
        model: Arc::new(ToolRoundModel::new("echo", "done")),
        tools,
        model_calls: Mutex::new(0),
        max_model_calls: 8,
        tool_round_limit: 2,
        records: Mutex::new(Vec::new()),
    };
    let answer = run_completion_with_tool_rounds(
        &host,
        &test_task(),
        "answer",
        vec![ChatMessage::text("user", "run echo")],
        true,
    )
    .await
    .expect("completion");

    assert_eq!(answer, "done");
    let records = host.records.lock().expect("lock");
    assert_eq!(records.len(), 1);
    assert_eq!(records[0].name, "echo");
    assert_eq!(records[0].status, "success");
}

#[tokio::test]
async fn passes_tool_schema_to_model() {
    struct SchemaCapturingModel {
        captured: Mutex<Option<Vec<LanguageModelToolDefinition>>>,
    }

    #[async_trait]
    impl LanguageModel for SchemaCapturingModel {
        fn model_label(&self) -> Option<&str> {
            Some("mock")
        }

        async fn complete(
            &self,
            _messages: &[ChatMessage],
            options: LanguageModelCompleteOptions<'_>,
        ) -> LanguageModelResponse {
            *self.captured.lock().expect("lock") = Some(
                options
                    .tools
                    .iter()
                    .map(|tool| LanguageModelToolDefinition {
                        name: tool.name.clone(),
                        description: tool.description.clone(),
                        schema: tool.schema.clone(),
                    })
                    .collect(),
            );
            LanguageModelResponse {
                content: "ok".into(),
                model: Some("mock".into()),
                tool_calls: Vec::new(),
            }
        }
    }

    let echo = Arc::new(EchoTool::new("echo")) as Arc<dyn Tool>;
    let mut tools = HashMap::new();
    tools.insert("echo".into(), echo);
    let model = Arc::new(SchemaCapturingModel {
        captured: Mutex::new(None),
    });
    let captured = Arc::clone(&model);
    let host = TestHost {
        model,
        tools,
        model_calls: Mutex::new(0),
        max_model_calls: 4,
        tool_round_limit: 0,
        records: Mutex::new(Vec::new()),
    };

    run_completion_with_tool_rounds(
        &host,
        &test_task(),
        "answer",
        vec![ChatMessage::text("user", "hello")],
        true,
    )
    .await
    .expect("completion");

    let defs = captured
        .captured
        .lock()
        .expect("lock")
        .clone()
        .expect("captured schemas");
    assert_eq!(defs.len(), 1);
    assert_eq!(defs[0].name, "echo");
    assert!(defs[0].schema.get("type").is_some());
}
