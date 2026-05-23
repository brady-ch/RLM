use std::io;

use serde_json::Value;

use crate::application::memory::validate_memory_budget as check_memory_budget;

pub(crate) fn validate_config_shape(config: &Value) -> io::Result<()> {
    let required = [
        "models",
        "memory",
        "runtime",
        "agents",
        "workflows",
        "interop",
        "hosts",
    ];
    let object = config.as_object().ok_or_else(|| {
        io::Error::new(
            io::ErrorKind::InvalidData,
            "expected config mapping at root",
        )
    })?;
    for key in required {
        if !object.contains_key(key) {
            return Err(io::Error::new(
                io::ErrorKind::InvalidData,
                format!("missing required config section: {key}"),
            ));
        }
    }
    Ok(())
}

pub(crate) fn validate_config_references(config: &Value) -> io::Result<()> {
    let tiers = config
        .pointer("/models/tiers")
        .and_then(Value::as_object)
        .cloned()
        .unwrap_or_default();
    if let Some(agents) = config.get("agents").and_then(Value::as_object) {
        for (agent_id, agent) in agents {
            if let Some(models) = agent.get("models").and_then(Value::as_object) {
                for (purpose, selection) in models {
                    let selection = selection.as_str().unwrap_or("");
                    if selection != "dynamic"
                        && !tiers.contains_key(selection)
                        && !selection.trim().is_empty()
                    {
                        return Err(io::Error::new(
                            io::ErrorKind::InvalidData,
                            format!(
                                "Agent \"{agent_id}\" has invalid model selection for {purpose}: {selection}"
                            ),
                        ));
                    }
                }
            }
        }
    }

    if let Some(workflows) = config.get("workflows").and_then(Value::as_object) {
        for (workflow_id, workflow) in workflows {
            if workflow.get("mode").and_then(Value::as_str) == Some("graph") {
                continue;
            }
            if let Some(agent_ids) = workflow.get("agents").and_then(Value::as_array) {
                for agent_id in agent_ids {
                    let agent_id = agent_id.as_str().unwrap_or("");
                    if !config
                        .pointer("/agents")
                        .and_then(Value::as_object)
                        .is_some_and(|agents| agents.contains_key(agent_id))
                    {
                        return Err(io::Error::new(
                            io::ErrorKind::InvalidData,
                            format!(
                                "Workflow \"{workflow_id}\" references unknown agent \"{agent_id}\"."
                            ),
                        ));
                    }
                }
            }
            if let Some(qa_agent) = workflow.pointer("/qa/agent").and_then(Value::as_str) {
                if !config
                    .pointer("/agents")
                    .and_then(Value::as_object)
                    .is_some_and(|agents| agents.contains_key(qa_agent))
                {
                    return Err(io::Error::new(
                        io::ErrorKind::InvalidData,
                        format!(
                            "Workflow \"{workflow_id}\" references unknown QA agent \"{qa_agent}\"."
                        ),
                    ));
                }
            }
        }
    }
    Ok(())
}

pub(crate) fn validate_memory_budget(config: &Value) -> io::Result<()> {
    check_memory_budget(config).map_err(|err| io::Error::new(io::ErrorKind::InvalidData, err))
}
