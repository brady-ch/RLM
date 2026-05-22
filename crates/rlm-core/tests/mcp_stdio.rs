use std::fs;
use std::path::PathBuf;

use rlm_core::interop::{create_mcp_tools, McpServerConfig, StdioMcpClient};
use serde_json::json;

fn mock_server_script() -> PathBuf {
    let dir = std::env::temp_dir().join(format!("rlm-mcp-mock-{}", std::process::id()));
    fs::create_dir_all(&dir).expect("tempdir");
    let path = dir.join("server.mjs");
    fs::write(
        &path,
        r#"
let buffer = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  buffer += chunk;
  for (;;) {
    const headerEnd = buffer.indexOf("\r\n\r\n");
    if (headerEnd < 0) return;
    const header = buffer.slice(0, headerEnd);
    const length = Number(header.match(/Content-Length:\s*(\d+)/i)?.[1] ?? "0");
    const bodyStart = headerEnd + 4;
    const bodyEnd = bodyStart + length;
    if (buffer.length < bodyEnd) return;
    const request = JSON.parse(buffer.slice(bodyStart, bodyEnd));
    buffer = buffer.slice(bodyEnd);
    if (request.id !== undefined) handle(request);
  }
});
function send(id, result) {
  const body = JSON.stringify({ jsonrpc: "2.0", id, result });
  process.stdout.write("Content-Length: " + Buffer.byteLength(body) + "\r\n\r\n" + body);
}
function handle(request) {
  if (request.method === "initialize") send(request.id, { capabilities: { tools: {} } });
  if (request.method === "tools/list") send(request.id, { tools: [{ name: "echo", description: "Echo", inputSchema: {} }] });
  if (request.method === "tools/call") send(request.id, { content: [{ type: "text", text: "mcp:" + request.params.arguments.text }] });
}
"#,
    )
    .expect("write mock server");
    path
}

#[tokio::test]
async fn mcp_stdio_client_uses_content_length_framing() {
    let server_path = mock_server_script();
    let client = StdioMcpClient::spawn(McpServerConfig {
        id: "local".into(),
        command: "node".into(),
        args: vec![server_path.to_string_lossy().to_string()],
        required: true,
    })
    .await
    .expect("spawn");

    client.initialize().await.expect("initialize");
    let tools = client.list_tools().await.expect("list");
    assert_eq!(tools.len(), 1);
    assert_eq!(tools[0].name, "echo");

    let result = client.call_tool("echo", json!({ "text": "hello" })).await;
    assert!(!result.is_error);
    assert_eq!(result.content, "mcp:hello");

    client.shutdown().await;
}

#[tokio::test]
async fn create_mcp_tools_registers_prefixed_names() {
    let server_path = mock_server_script();
    let result = create_mcp_tools(vec![McpServerConfig {
        id: "local".into(),
        command: "node".into(),
        args: vec![server_path.to_string_lossy().to_string()],
        required: true,
    }])
    .await
    .expect("create tools");

    assert_eq!(result.tools.len(), 1);
    assert_eq!(result.tools[0].name(), "local.echo");
    for client in result.clients {
        client.shutdown().await;
    }
}
