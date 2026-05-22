use std::collections::HashMap;
use std::sync::atomic::{AtomicI64, Ordering};
use std::sync::Arc;

use serde_json::{json, Value};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::process::{Child, Command};
use tokio::sync::Mutex;

use crate::domain::types::ToolExecutionResult;

#[derive(Debug, Clone)]
pub struct McpServerConfig {
    pub id: String,
    pub command: String,
    pub args: Vec<String>,
    pub required: bool,
}

#[derive(Debug, Clone)]
pub struct McpToolDescriptor {
    pub name: String,
    pub description: Option<String>,
    pub input_schema: Value,
}

type PendingMap = HashMap<i64, tokio::sync::oneshot::Sender<Result<Value, String>>>;

pub struct StdioMcpClient {
    server_id: String,
    child: Arc<Mutex<Option<Child>>>,
    stdin: Arc<Mutex<Option<tokio::process::ChildStdin>>>,
    pending: Arc<Mutex<PendingMap>>,
    next_id: AtomicI64,
}

impl StdioMcpClient {
    pub async fn spawn(server: McpServerConfig) -> Result<Self, String> {
        let mut command = Command::new(&server.command);
        command.args(&server.args);
        command.stdin(std::process::Stdio::piped());
        command.stdout(std::process::Stdio::piped());
        command.stderr(std::process::Stdio::null());
        command.kill_on_drop(true);

        let mut child = command
            .spawn()
            .map_err(|err| format!("Failed to spawn MCP server {}: {err}", server.id))?;
        let stdout = child
            .stdout
            .take()
            .ok_or_else(|| format!("MCP server {} missing stdout", server.id))?;
        let stdin = child
            .stdin
            .take()
            .ok_or_else(|| format!("MCP server {} missing stdin", server.id))?;

        let client = Self {
            server_id: server.id.clone(),
            child: Arc::new(Mutex::new(Some(child))),
            stdin: Arc::new(Mutex::new(Some(stdin))),
            pending: Arc::new(Mutex::new(HashMap::new())),
            next_id: AtomicI64::new(1),
        };

        let reader_client = client.clone_for_reader();
        tokio::spawn(async move {
            reader_client.read_loop(stdout).await;
        });

        Ok(client)
    }

    fn clone_for_reader(&self) -> Self {
        Self {
            server_id: self.server_id.clone(),
            child: Arc::clone(&self.child),
            stdin: Arc::clone(&self.stdin),
            pending: Arc::clone(&self.pending),
            next_id: AtomicI64::new(0),
        }
    }

    pub async fn initialize(&self) -> Result<(), String> {
        self.request(
            "initialize",
            json!({
                "protocolVersion": "2024-11-05",
                "capabilities": {},
                "clientInfo": { "name": "rlm", "version": "1.0.0" },
            }),
        )
        .await?;
        let _ = self.notify("notifications/initialized", json!({})).await;
        Ok(())
    }

    pub async fn list_tools(&self) -> Result<Vec<McpToolDescriptor>, String> {
        let result = self.request("tools/list", json!({})).await?;
        let tools = result
            .get("tools")
            .and_then(Value::as_array)
            .cloned()
            .unwrap_or_default();
        Ok(tools
            .into_iter()
            .filter_map(|tool| {
                let name = tool.get("name")?.as_str()?.to_string();
                Some(McpToolDescriptor {
                    description: tool
                        .get("description")
                        .and_then(Value::as_str)
                        .map(str::to_string),
                    input_schema: tool
                        .get("inputSchema")
                        .cloned()
                        .unwrap_or_else(|| json!({})),
                    name,
                })
            })
            .collect())
    }

    pub async fn call_tool(&self, name: &str, args: Value) -> ToolExecutionResult {
        match self
            .request("tools/call", json!({ "name": name, "arguments": args }))
            .await
        {
            Ok(result) => ToolExecutionResult {
                content: stringify_tool_result(&result),
                is_error: false,
            },
            Err(err) => ToolExecutionResult {
                content: err,
                is_error: true,
            },
        }
    }

    pub async fn shutdown(&self) {
        let mut child_guard = self.child.lock().await;
        if let Some(mut child) = child_guard.take() {
            let _ = child.kill().await;
        }
        let mut stdin_guard = self.stdin.lock().await;
        stdin_guard.take();
        let mut pending = self.pending.lock().await;
        pending.clear();
    }

    async fn notify(&self, method: &str, params: Value) -> Result<(), String> {
        let payload = json!({ "jsonrpc": "2.0", "method": method, "params": params });
        self.write_message(&payload).await
    }

    async fn request(&self, method: &str, params: Value) -> Result<Value, String> {
        let id = self.next_id.fetch_add(1, Ordering::SeqCst);
        let payload = json!({ "jsonrpc": "2.0", "id": id, "method": method, "params": params });
        let (tx, rx) = tokio::sync::oneshot::channel();
        self.pending.lock().await.insert(id, tx);
        self.write_message(&payload).await?;
        rx.await
            .map_err(|_| format!("MCP server {} closed before response", self.server_id))?
    }

    async fn write_message(&self, payload: &Value) -> Result<(), String> {
        let body = serde_json::to_string(payload)
            .map_err(|err| format!("Failed to encode MCP message: {err}"))?;
        let frame = format!("Content-Length: {}\r\n\r\n{}", body.len(), body);
        let mut stdin_guard = self.stdin.lock().await;
        let stdin = stdin_guard
            .as_mut()
            .ok_or_else(|| format!("MCP server {} stdin closed", self.server_id))?;
        stdin
            .write_all(frame.as_bytes())
            .await
            .map_err(|err| format!("Failed to write MCP frame: {err}"))?;
        stdin
            .flush()
            .await
            .map_err(|err| format!("Failed to flush MCP stdin: {err}"))?;
        Ok(())
    }

    async fn read_loop(&self, mut stdout: tokio::process::ChildStdout) {
        let mut buffer = String::new();
        let mut scratch = [0u8; 4096];
        loop {
            let read = match stdout.read(&mut scratch).await {
                Ok(0) => break,
                Ok(n) => n,
                Err(_) => break,
            };
            buffer.push_str(&String::from_utf8_lossy(&scratch[..read]));
            loop {
                if buffer.starts_with("Content-Length:") {
                    let Some(header_end) = buffer.find("\r\n\r\n") else {
                        break;
                    };
                    let header = &buffer[..header_end];
                    let length = header
                        .split(':')
                        .nth(1)
                        .and_then(|value| value.trim().parse::<usize>().ok())
                        .unwrap_or(0);
                    let body_start = header_end + 4;
                    let body_end = body_start + length;
                    if buffer.len() < body_end {
                        break;
                    }
                    let body = buffer[body_start..body_end].to_string();
                    buffer = buffer[body_end..].to_string();
                    if let Ok(response) = serde_json::from_str::<Value>(&body) {
                        self.handle_response(response).await;
                    }
                    continue;
                }

                let Some(newline) = buffer.find('\n') else {
                    break;
                };
                let line = buffer[..newline].trim().to_string();
                buffer = buffer[newline + 1..].to_string();
                if line.is_empty() {
                    continue;
                }
                if let Ok(response) = serde_json::from_str::<Value>(&line) {
                    self.handle_response(response).await;
                }
            }
        }
        self.reject_all("MCP server stream closed".into()).await;
    }

    async fn handle_response(&self, response: Value) {
        let Some(id) = response.get("id").and_then(Value::as_i64) else {
            return;
        };
        let Some(tx) = self.pending.lock().await.remove(&id) else {
            return;
        };
        if let Some(error) = response.get("error") {
            let message = error
                .get("message")
                .and_then(Value::as_str)
                .unwrap_or("MCP request failed");
            let _ = tx.send(Err(message.to_string()));
            return;
        }
        let result = response.get("result").cloned().unwrap_or(Value::Null);
        let _ = tx.send(Ok(result));
    }

    async fn reject_all(&self, message: String) {
        let mut pending = self.pending.lock().await;
        for (_, tx) in pending.drain() {
            let _ = tx.send(Err(message.clone()));
        }
    }
}

fn stringify_tool_result(result: &Value) -> String {
    if let Some(text) = result.as_str() {
        return text.to_string();
    }
    if let Some(content) = result.get("content").and_then(Value::as_array) {
        return content
            .iter()
            .filter_map(|item| item.get("text").and_then(Value::as_str))
            .collect::<Vec<_>>()
            .join("\n");
    }
    result.to_string()
}

pub fn parse_mcp_servers(config: Option<&Value>) -> Vec<McpServerConfig> {
    let Some(config) = config else {
        return Vec::new();
    };
    let Some(servers) = config
        .pointer("/interop/mcp/servers")
        .and_then(Value::as_array)
    else {
        return Vec::new();
    };
    servers
        .iter()
        .filter_map(|server| {
            let id = server.get("id")?.as_str()?.to_string();
            let command = server.get("command")?.as_str()?.to_string();
            let args = server
                .get("args")
                .and_then(Value::as_array)
                .map(|items| {
                    items
                        .iter()
                        .filter_map(Value::as_str)
                        .map(str::to_string)
                        .collect::<Vec<_>>()
                })
                .unwrap_or_default();
            let required = server
                .get("required")
                .and_then(Value::as_bool)
                .unwrap_or(false);
            Some(McpServerConfig {
                id,
                command,
                args,
                required,
            })
        })
        .collect()
}

pub fn block_on_async<F: std::future::Future>(future: F) -> F::Output {
    if let Ok(handle) = tokio::runtime::Handle::try_current() {
        return handle.block_on(future);
    }
    let runtime = tokio::runtime::Builder::new_multi_thread()
        .enable_all()
        .build()
        .expect("tokio runtime");
    runtime.block_on(future)
}
