use async_trait::async_trait;

use rlm_core::domain::recursive_language_model::ExecutionControl;
use rlm_core::domain::types::{
    ExecutionEvent, ExecutionGraphNode, ExecutionStatus, ExecutionStatusUpdateDetail,
    NodeApprovalDecision, NodeApprovalStatus, QualityLoopManualDecision,
};

pub struct CliExecutionControl {
    pub plan_only: bool,
    pub auto_approve: bool,
}

impl CliExecutionControl {
    pub fn plan_only() -> Self {
        Self {
            plan_only: true,
            auto_approve: false,
        }
    }

    pub fn execute(auto_approve: bool) -> Self {
        Self {
            plan_only: false,
            auto_approve,
        }
    }
}

#[async_trait]
impl ExecutionControl for CliExecutionControl {
    fn plan_only(&self) -> bool {
        self.plan_only
    }

    fn is_cancelled(&self) -> bool {
        false
    }

    fn cancel_reason(&self) -> Option<String> {
        None
    }

    fn on_event(&self, _event: ExecutionEvent) {}

    fn register_node(&self, _node: ExecutionGraphNode) {}

    fn update_node_status(
        &self,
        _node_id: &str,
        _status: ExecutionStatus,
        _detail: Option<ExecutionStatusUpdateDetail>,
    ) {
    }

    async fn wait_for_node_approval(&self, node: ExecutionGraphNode) -> NodeApprovalDecision {
        if self.auto_approve {
            return NodeApprovalDecision {
                status: NodeApprovalStatus::Approved,
                prompt: node.prompt.unwrap_or(node.label),
                model_override: node.model_override,
            };
        }
        NodeApprovalDecision {
            status: NodeApprovalStatus::Approved,
            prompt: node.prompt.unwrap_or(node.label),
            model_override: node.model_override,
        }
    }

    fn get_quality_loop_decision(&self, _node_id: &str) -> Option<QualityLoopManualDecision> {
        None
    }
}
