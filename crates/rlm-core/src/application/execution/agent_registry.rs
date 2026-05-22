use std::collections::HashSet;

use serde_json::Value;

const KNOWN_AGENTS: &[&str] = &["default", "coding", "qa", "product_designer", "research"];

#[derive(Debug, Clone)]
pub struct AgentProfile {
    pub id: String,
    pub system_prompt: String,
    pub tool_names: Vec<String>,
}

pub fn is_known_expert_agent(agent_id: &str) -> bool {
    KNOWN_AGENTS.contains(&agent_id.trim())
}

pub fn resolve_agent(
    agent_id: &str,
    project_config: Option<&Value>,
) -> Result<AgentProfile, String> {
    let id = agent_id.trim();
    if !is_known_expert_agent(id) {
        return Err(format!("Unknown agent \"{id}\"."));
    }

    let tool_names = project_config
        .and_then(|cfg| cfg.get("agents"))
        .and_then(|agents| agents.get(id))
        .and_then(|entry| entry.get("tools"))
        .and_then(|tools| tools.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|v| v.as_str().map(String::from))
                .collect()
        })
        .unwrap_or_default();

    let system_prompt = match id {
        "coding" => "You are a coding agent. Inspect the workspace before changing behavior.",
        "qa" => "You are a QA agent. Review implementation results and validation output.",
        "product_designer" => {
            "You are a product designer. Focus on user goals, product flows, and UX tradeoffs."
        }
        "research" => "You are a research agent. Gather and synthesize relevant information.",
        _ => "You are a general recursive assistant.",
    }
    .to_string();

    Ok(AgentProfile {
        id: id.to_string(),
        system_prompt,
        tool_names,
    })
}

pub fn filter_agent_tools(agent: &AgentProfile, allowlist: Option<&[String]>) -> AgentProfile {
    let Some(allowlist) = allowlist else {
        return agent.clone();
    };
    if allowlist.is_empty() {
        return agent.clone();
    }
    let allowed: HashSet<_> = allowlist
        .iter()
        .map(|t| t.trim())
        .filter(|t| !t.is_empty())
        .collect();
    AgentProfile {
        tool_names: agent
            .tool_names
            .iter()
            .filter(|name| allowed.contains(name.as_str()))
            .cloned()
            .collect(),
        ..agent.clone()
    }
}
