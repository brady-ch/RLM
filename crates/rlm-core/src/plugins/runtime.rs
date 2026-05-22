use std::collections::HashSet;
use std::path::Path;
use std::sync::Arc;

use serde_json::Value;

use super::builtin::load_builtins;
use super::extension_host::ExtensionHost;
use crate::execution::agent_registry::{filter_agent_tools, AgentProfile};
use crate::ports::Tool;

pub const COMPOSITION_INIT_ORDER: &[&str] = &[
    "plugins",
    "interop",
    "tools-resolver",
    "agent-registry",
    "models",
];

pub type CompositionInitStage = &'static str;
pub type CompositionInitStageRecorder = Box<dyn Fn(CompositionInitStage) + Send + Sync>;

pub struct RuntimeContext {
    pub extension_host: ExtensionHost,
    pub tools: Vec<Arc<dyn Tool>>,
    pub init_stages: Vec<CompositionInitStage>,
    pub interop_warnings: Vec<String>,
    _mcp_clients: Vec<Arc<crate::interop::StdioMcpClient>>,
}

impl Clone for RuntimeContext {
    fn clone(&self) -> Self {
        Self {
            extension_host: self.extension_host.clone(),
            tools: self.tools.clone(),
            init_stages: self.init_stages.clone(),
            interop_warnings: self.interop_warnings.clone(),
            _mcp_clients: self._mcp_clients.clone(),
        }
    }
}

pub struct BuildRuntimeContextInput<'a> {
    pub project_root: &'a Path,
    pub project_config: Option<&'a Value>,
    pub on_init_stage: Option<CompositionInitStageRecorder>,
}

pub fn build_runtime_context(
    input: BuildRuntimeContextInput<'_>,
) -> Result<RuntimeContext, String> {
    let mut stages = Vec::new();
    let record = |stage: CompositionInitStage, stages: &mut Vec<CompositionInitStage>| {
        stages.push(stage);
        if let Some(recorder) = &input.on_init_stage {
            recorder(stage);
        }
    };

    let mut extension_host = ExtensionHost::new();
    load_builtins(&mut extension_host, input.project_root);
    record("plugins", &mut stages);

    let mcp = crate::interop::load_mcp_interop(input.project_config, &mut extension_host)?;
    record("interop", &mut stages);

    let tools = extension_host.all_tools();
    record("tools-resolver", &mut stages);

    // Agent registry resolution happens at execution bind time.
    record("agent-registry", &mut stages);
    record("models", &mut stages);

    Ok(RuntimeContext {
        extension_host,
        tools,
        init_stages: stages,
        interop_warnings: mcp.warnings,
        _mcp_clients: mcp.clients,
    })
}

pub fn resolve_tools_for_agent(
    runtime: &RuntimeContext,
    agent: &AgentProfile,
    allowlist: Option<&[String]>,
) -> Vec<Arc<dyn Tool>> {
    let filtered = filter_agent_tools(agent, allowlist);
    if filtered.tool_names.is_empty() {
        return runtime.tools.clone();
    }
    let allowed: HashSet<_> = filtered
        .tool_names
        .iter()
        .map(|name| name.as_str())
        .collect();
    runtime
        .tools
        .iter()
        .filter(|tool| allowed.contains(tool.name()))
        .cloned()
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn init_order_matches_v17_pipeline() {
        let temp = tempfile::tempdir().expect("tempdir");
        let ctx = build_runtime_context(BuildRuntimeContextInput {
            project_root: temp.path(),
            project_config: None,
            on_init_stage: None,
        })
        .expect("runtime");
        assert_eq!(ctx.init_stages, COMPOSITION_INIT_ORDER);
    }

    #[test]
    fn loads_builtin_tools() {
        let temp = tempfile::tempdir().expect("tempdir");
        let ctx = build_runtime_context(BuildRuntimeContextInput {
            project_root: temp.path(),
            project_config: None,
            on_init_stage: None,
        })
        .expect("runtime");
        let names: HashSet<_> = ctx.tools.iter().map(|t| t.name().to_string()).collect();
        assert!(names.contains("shell"));
        assert!(names.contains("write_file"));
        assert!(names.contains("web_search"));
        assert!(names.contains("web_fetch"));
    }
}
