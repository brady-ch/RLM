use std::sync::Arc;

use async_trait::async_trait;
use serde_json::Value;

use super::mcp_stdio_client::{block_on_async, parse_mcp_servers, McpServerConfig, StdioMcpClient};
use crate::domain::types::ToolExecutionResult;
use crate::plugins::extension_host::ExtensionHost;
use crate::ports::Tool;

pub struct McpInteropResult {
    pub tools: Vec<Arc<dyn Tool>>,
    pub warnings: Vec<String>,
    pub clients: Vec<Arc<StdioMcpClient>>,
}

struct McpTool {
    name: String,
    description: String,
    schema: Value,
    client: Arc<StdioMcpClient>,
    tool_name: String,
}

#[async_trait]
impl Tool for McpTool {
    fn name(&self) -> &str {
        &self.name
    }

    fn description(&self) -> &str {
        &self.description
    }

    fn schema(&self) -> Value {
        self.schema.clone()
    }

    async fn execute(&self, arguments: Value) -> ToolExecutionResult {
        self.client.call_tool(&self.tool_name, arguments).await
    }
}

pub async fn create_mcp_tools(servers: Vec<McpServerConfig>) -> Result<McpInteropResult, String> {
    let mut tools: Vec<Arc<dyn Tool>> = Vec::new();
    let mut warnings = Vec::new();
    let mut clients = Vec::new();

    for server in servers {
        match StdioMcpClient::spawn(server.clone()).await {
            Ok(client) => {
                let client = Arc::new(client);
                match client.initialize().await {
                    Ok(()) => match client.list_tools().await {
                        Ok(listed) => {
                            for tool in listed {
                                let full_name = format!("{}.{}", server.id, tool.name);
                                let description = tool
                                    .description
                                    .clone()
                                    .unwrap_or_else(|| format!("MCP tool {} from {}", tool.name, server.id));
                                tools.push(Arc::new(McpTool {
                                    name: full_name,
                                    description,
                                    schema: tool.input_schema,
                                    client: Arc::clone(&client),
                                    tool_name: tool.name,
                                }) as Arc<dyn Tool>);
                            }
                            clients.push(client);
                        }
                        Err(err) => {
                            client.shutdown().await;
                            handle_disconnect(&server, &err, &mut warnings)?;
                        }
                    },
                    Err(err) => {
                        client.shutdown().await;
                        handle_disconnect(&server, &err, &mut warnings)?;
                    }
                }
            }
            Err(err) => handle_disconnect(&server, &err, &mut warnings)?,
        }
    }

    Ok(McpInteropResult {
        tools,
        warnings,
        clients,
    })
}

fn handle_disconnect(
    server: &McpServerConfig,
    err: &str,
    warnings: &mut Vec<String>,
) -> Result<(), String> {
    let message = format!(
        "MCP configured but server '{}' not connected: {}",
        server.id, err
    );
    if server.required {
        return Err(message);
    }
    warnings.push(message);
    Ok(())
}

pub fn load_mcp_interop(
    project_config: Option<&Value>,
    extension_host: &mut ExtensionHost,
) -> Result<McpInteropResult, String> {
    let servers = parse_mcp_servers(project_config);
    if servers.is_empty() {
        return Ok(McpInteropResult {
            tools: Vec::new(),
            warnings: Vec::new(),
            clients: Vec::new(),
        });
    }

    let result = block_on_async(create_mcp_tools(servers))?;
    for tool in &result.tools {
        extension_host
            .register_tool(Arc::clone(tool))
            .map_err(|err| format!("Failed to register MCP tool: {err}"))?;
    }
    Ok(result)
}
