use async_trait::async_trait;

use crate::domain::types::{
    ExecutionEvent, ExecutionGraphNode, ExecutionStatus, ExecutionStatusUpdateDetail,
    NodeApprovalDecision, QualityLoopManualDecision,
};

#[async_trait]
pub trait ExecutionControl: Send + Sync {
    fn plan_only(&self) -> bool;
    fn is_cancelled(&self) -> bool;
    fn cancel_reason(&self) -> Option<String>;
    fn on_event(&self, event: ExecutionEvent);
    fn register_node(&self, node: ExecutionGraphNode);
    fn update_node_status(
        &self,
        node_id: &str,
        status: ExecutionStatus,
        detail: Option<ExecutionStatusUpdateDetail>,
    );
    async fn wait_for_node_approval(&self, node: ExecutionGraphNode) -> NodeApprovalDecision;
    fn get_quality_loop_decision(&self, _node_id: &str) -> Option<QualityLoopManualDecision> {
        None
    }
}
