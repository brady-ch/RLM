use std::collections::HashMap;

use serde_json::Value;

use crate::domain::types::{ExecutionStatus, GraphPosition, GraphViewport, SessionSnapshot};

use super::super::InteractiveExecutionSession;

impl InteractiveExecutionSession {
    pub fn restore_snapshot(&self, snapshot: SessionSnapshot) {
        {
            let mut nodes = self.nodes.lock().expect("nodes");
            nodes.clear();
            for node in snapshot.graph.nodes {
                nodes.insert(node.id.clone(), node);
            }
        }
        *self.edges.lock().expect("edges") = snapshot.graph.edges;
        if let Some(vp) = snapshot.graph.viewport {
            *self.viewport.lock().expect("viewport") = vp;
        }
    }

    pub fn update_graph_layout(&self, positions: HashMap<String, GraphPosition>) {
        let mut nodes = self.nodes.lock().expect("nodes");
        for (id, pos) in positions {
            if let Some(node) = nodes.get_mut(&id) {
                node.position = Some(pos);
            }
        }
        drop(nodes);
        self.publish(crate::domain::types::ExecutionEvent::execution(
            ExecutionStatus::Planned,
        ));
    }

    pub fn set_graph_viewport(&self, viewport: GraphViewport) {
        let zoom = if viewport.zoom.is_finite() && viewport.zoom > 0.0 {
            viewport.zoom
        } else {
            1.0
        };
        *self.viewport.lock().expect("viewport") = GraphViewport {
            x: if viewport.x.is_finite() {
                viewport.x
            } else {
                0.0
            },
            y: if viewport.y.is_finite() {
                viewport.y
            } else {
                0.0
            },
            zoom,
        };
        self.publish(crate::domain::types::ExecutionEvent::execution(
            ExecutionStatus::Planned,
        ));
    }

    pub fn graph_workflow_metadata_value(&self) -> Option<Value> {
        self.graph_workflow_metadata
            .lock()
            .expect("meta")
            .as_ref()
            .map(|meta| {
                serde_json::json!({
                    "version": 1,
                    "linkedWorkflowId": meta.linked_workflow_id,
                    "lastVariant": meta.last_variant,
                    "exportedAt": meta.exported_at,
                })
            })
    }

    pub fn set_graph_workflow_metadata_from_restore(&self, metadata: &Value) {
        let linked = metadata
            .get("linkedWorkflowId")
            .and_then(|v| v.as_str())
            .map(str::to_string);
        let variant = metadata
            .get("lastVariant")
            .and_then(|v| v.as_str())
            .map(str::to_string);
        let exported = metadata
            .get("exportedAt")
            .and_then(|v| v.as_str())
            .map(str::to_string);
        self.patch_graph_workflow_metadata(linked, variant, exported);
    }

    pub fn patch_graph_workflow_metadata(
        &self,
        linked_workflow_id: Option<String>,
        last_variant: Option<String>,
        exported_at: Option<String>,
    ) {
        *self.graph_workflow_metadata.lock().expect("meta") =
            Some(crate::domain::types::GraphWorkflowMetadata {
                linked_workflow_id,
                last_variant,
                exported_at,
            });
    }
}
