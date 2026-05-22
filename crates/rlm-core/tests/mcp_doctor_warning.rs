use rlm_core::interop::{create_mcp_tools, McpServerConfig};
use rlm_core::plugins::{build_runtime_context, BuildRuntimeContextInput};
use serde_json::json;

#[tokio::test]
async fn optional_mcp_failure_surfaces_warning() {
    let result = create_mcp_tools(vec![McpServerConfig {
        id: "missing".into(),
        command: "/nonexistent/mcp-server".into(),
        args: vec![],
        required: false,
    }])
    .await
    .expect("optional server should not fail init");

    assert!(result.tools.is_empty());
    assert_eq!(result.warnings.len(), 1);
    assert!(result.warnings[0].contains("missing"));
    assert!(result.warnings[0].contains("not connected"));
}

#[test]
fn build_runtime_context_records_interop_warning_for_optional_disconnect() {
    let temp = tempfile::tempdir().expect("tempdir");
    let config = json!({
        "interop": {
            "mcp": {
                "servers": [{
                    "id": "opt",
                    "command": "/nonexistent/mcp-server",
                    "args": [],
                    "required": false
                }]
            },
            "skills": {
                "searchPaths": [],
                "duplicateStrategy": "first_match",
                "cache": false,
                "pathPolicies": []
            }
        }
    });

    let ctx = build_runtime_context(BuildRuntimeContextInput {
        project_root: temp.path(),
        project_config: Some(&config),
        on_init_stage: None,
    })
    .expect("runtime");

    assert_eq!(ctx.interop_warnings.len(), 1);
    assert!(ctx.interop_warnings[0].contains("opt"));
}
