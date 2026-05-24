use std::collections::HashSet;

#[derive(Debug, Clone)]
pub struct AgentProfile {
    pub id: String,
    pub system_prompt: String,
    pub tool_names: Vec<String>,
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
