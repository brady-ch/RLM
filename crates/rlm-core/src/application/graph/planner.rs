use std::sync::Arc;

use serde::Deserialize;
use serde_json::Value;

use crate::domain::types::ExpertRuntimeMode;
use crate::ports::{LanguageModel, LanguageModelCompleteOptions};

#[derive(Debug, Clone, Deserialize)]
pub struct PlannedChildSpec {
    pub label: String,
    pub prompt: String,
    #[serde(rename = "type")]
    pub node_type: String,
    pub complexity: String,
    #[serde(rename = "agentId")]
    pub agent_id: Option<String>,
    pub runtime: Option<ExpertRuntimeMode>,
    #[serde(rename = "toolAllowlist")]
    pub tool_allowlist: Option<Vec<String>>,
    #[serde(rename = "purposeTiers")]
    pub purpose_tiers: Option<std::collections::HashMap<String, String>>,
}

#[derive(Debug, Clone)]
pub struct GraphPlannerContext {
    pub node_id: String,
    pub node_label: String,
    pub node_prompt: String,
    pub ancestors: Vec<(String, String, String)>,
    pub protected_descendants: Vec<(String, String, String)>,
    pub max_children: i32,
}

#[derive(Debug)]
pub struct GraphPlannerError {
    pub code: String,
    pub message: String,
}

pub async fn plan_children(
    model: Arc<dyn LanguageModel>,
    context: GraphPlannerContext,
) -> Result<Vec<PlannedChildSpec>, String> {
    let system = format!(
        "You plan direct child nodes for an execution graph. Return ONLY JSON in this shape: \
         {{\"children\":[{{\"label\":\"\",\"prompt\":\"\",\"type\":\"AI\",\"complexity\":\"medium\"}}]}}. \
         Return between 1 and {} children.",
        context.max_children
    );
    let user = format!(
        "Target node id: {}\nTarget label: {}\nTarget prompt: {}",
        context.node_id, context.node_label, context.node_prompt
    );
    let response = model
        .complete(
            &[
                crate::domain::types::ChatMessage {
                    role: "system".into(),
                    content: system,
                },
                crate::domain::types::ChatMessage {
                    role: "user".into(),
                    content: user,
                },
            ],
            LanguageModelCompleteOptions::simple(Some("plan"), false),
        )
        .await;

    if response.content.starts_with("Ollama inference failed:") {
        return Err(format!(
            "MUTATION:planning_failed|Graph planning failed.|{}|{}|",
            context.node_id,
            response.content.trim()
        ));
    }

    let json_text = extract_json_object(&response.content).ok_or_else(|| {
        format!(
            "MUTATION:invalid_planner_output|Planner returned invalid output.|{}||",
            context.node_id
        )
    })?;

    let parsed: Value = serde_json::from_str(json_text).map_err(|e| {
        format!(
            "MUTATION:invalid_planner_output|Planner returned invalid output.|{}|{e}|",
            context.node_id
        )
    })?;
    let children = parsed
        .get("children")
        .and_then(|c| c.as_array())
        .ok_or_else(|| {
            format!(
                "MUTATION:invalid_planner_output|Planner returned invalid output.|{}||",
                context.node_id
            )
        })?;

    let mut specs = Vec::new();
    for child in children.iter().take(context.max_children as usize) {
        let spec: PlannedChildSpec = serde_json::from_value(child.clone()).map_err(|e| {
            format!(
                "MUTATION:invalid_planner_output|Planner returned invalid output.|{}|{e}|",
                context.node_id
            )
        })?;
        specs.push(spec);
    }
    if specs.is_empty() {
        return Err(format!(
            "MUTATION:planning_failed|Graph planning failed.|{}|No children returned.|",
            context.node_id
        ));
    }
    Ok(specs)
}

fn extract_json_object(content: &str) -> Option<&str> {
    let start = content.find('{')?;
    let end = content.rfind('}')?;
    if end <= start {
        return None;
    }
    Some(&content[start..=end])
}
