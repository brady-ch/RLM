use std::collections::HashMap;
use std::sync::{Arc, Mutex};

use crate::domain::recursion::limit_prompt;
use crate::domain::types::{
    ExecutionStatus, RecursiveModelConfig, RecursivePromptResult, TaskNode, TokenUsageTrace,
};
use crate::ports::{LanguageModel, Tool, Trace};

pub(crate) const DIRECT: &str = "DIRECT";
pub(crate) const RECURSIVE: &str = "RECURSIVE";

mod engine_hosts;
mod engine_state;
mod execution_bridge;
mod execution_control;
mod orchestrator_phases;
mod solve_tree;

use engine_state::{empty_metadata, EngineState};

pub use execution_control::ExecutionControl;

pub struct RecursiveLanguageModel {
    pub(crate) model: Arc<dyn LanguageModel>,
    pub(crate) trace: Arc<dyn Trace>,
    pub(crate) tools: HashMap<String, Arc<dyn Tool>>,
    pub(crate) state: Mutex<EngineState>,
}

impl RecursiveLanguageModel {
    pub fn new(
        model: Arc<dyn LanguageModel>,
        trace: Arc<dyn Trace>,
        tools: Vec<Arc<dyn Tool>>,
    ) -> Self {
        let tools_map = tools
            .into_iter()
            .map(|t| (t.name().to_string(), t))
            .collect();
        Self {
            model,
            trace,
            tools: tools_map,
            state: Mutex::new(EngineState {
                next_id: 1,
                model_calls: 0,
                max_model_calls: u32::MAX,
                tool_round_limit: 0,
                agent_system_prompt: String::new(),
                metadata: empty_metadata(),
                execution_nodes: HashMap::new(),
                execution_edges: Vec::new(),
                tool_calls_len: 0,
                token_usage: TokenUsageTrace::default(),
            }),
        }
    }

    pub async fn run(
        &self,
        prompt: &str,
        config: RecursiveModelConfig,
        execution: Option<Arc<dyn ExecutionControl>>,
    ) -> Result<RecursivePromptResult, String> {
        {
            let mut state = self.state.lock().expect("engine lock");
            state.next_id = 1;
            state.model_calls = 0;
            state.max_model_calls = config.max_model_calls;
            state.tool_round_limit = config.max_tool_rounds;
            state.metadata = empty_metadata();
            state.execution_nodes.clear();
            state.execution_edges.clear();
            state.tool_calls_len = 0;
            state.agent_system_prompt.clear();
        }

        if config.quality_loop.as_ref().is_some_and(|q| q.enabled) {
            return self.run_quality_loop_path(prompt, config, execution).await;
        }

        let depth = self
            .select_depth(prompt, &config, execution.clone())
            .await?;
        let mut effective = config.clone();
        effective.max_depth = Some(depth);

        let root = {
            let mut state = self.state.lock().expect("engine lock");
            let id = state.create_id();
            TaskNode {
                id,
                parent_id: None,
                prompt: limit_prompt(prompt, &effective),
                depth: 0,
                kind: None,
                model_override: None,
            }
        };

        self.ensure_execution_node(&root, "task", prompt);
        self.set_execution_status(
            &execution,
            if execution.as_ref().is_some_and(|e| e.plan_only()) {
                ExecutionStatus::Planned
            } else {
                ExecutionStatus::Running
            },
        );
        self.emit_execution(
            &execution,
            ExecutionStatus::Running,
            Some(root.id.clone()),
            if execution.as_ref().is_some_and(|e| e.plan_only()) {
                "execution plan created"
            } else {
                "execution started"
            },
        );

        if execution.as_ref().is_some_and(|e| e.plan_only()) {
            self.update_execution_graph(&effective);
            return Ok(self.build_result());
        }

        match self.solve_inner(&root, &effective, execution.clone()).await {
            Ok(answer) => {
                self.sync_execution_status_with_outcome(&execution);
                {
                    let mut state = self.state.lock().expect("engine lock");
                    state.metadata.model_calls = state.model_calls;
                }
                self.update_execution_graph(&effective);
                let mut result = self.build_result();
                result.answer = answer;
                Ok(result)
            }
            Err(err) => {
                if !execution.as_ref().is_some_and(|e| e.is_cancelled()) {
                    self.set_execution_status(&execution, ExecutionStatus::Failed);
                }
                self.update_execution_graph(&effective);
                Err(err)
            }
        }
    }
}

pub use crate::ports::trace::InMemoryTrace;
