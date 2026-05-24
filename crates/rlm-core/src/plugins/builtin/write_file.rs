use std::path::{Path, PathBuf};

use async_trait::async_trait;
use tokio::fs;
use tokio::io::AsyncWriteExt;

use crate::ports::ToolExecutionResult;
use crate::plugins::tool_schemas;
use crate::ports::Tool;

pub struct WorkspaceFileWriteTool {
    workspace_root: PathBuf,
}

impl WorkspaceFileWriteTool {
    pub fn new(workspace_root: &Path) -> Self {
        Self {
            workspace_root: workspace_root
                .canonicalize()
                .unwrap_or_else(|_| workspace_root.to_path_buf()),
        }
    }

    fn resolve_workspace_path(&self, path: &str) -> Option<PathBuf> {
        use std::path::Component;

        let path = path.trim();
        if path.is_empty() {
            return None;
        }
        let mut resolved = self.workspace_root.clone();
        for component in Path::new(path).components() {
            match component {
                Component::ParentDir => {
                    if !resolved.pop() {
                        return None;
                    }
                }
                Component::Normal(part) => resolved.push(part),
                Component::CurDir => {}
                _ => return None,
            }
        }
        if !resolved.starts_with(&self.workspace_root) {
            return None;
        }
        Some(resolved)
    }
}

#[async_trait]
impl Tool for WorkspaceFileWriteTool {
    fn name(&self) -> &str {
        "write_file"
    }

    fn description(&self) -> &str {
        "Write content to a file inside the open workspace directory. Use relative paths only. Supports overwrite and append."
    }

    fn schema(&self) -> serde_json::Value {
        tool_schemas::write_file_schema()
    }

    async fn execute(&self, arguments: serde_json::Value) -> ToolExecutionResult {
        let path = arguments.get("path").and_then(|v| v.as_str()).unwrap_or("");
        let content = arguments
            .get("content")
            .and_then(|v| v.as_str())
            .unwrap_or("");
        let mode = arguments
            .get("mode")
            .and_then(|v| v.as_str())
            .unwrap_or("overwrite");

        let Some(target) = self.resolve_workspace_path(path) else {
            return ToolExecutionResult {
                content: format!("Path is outside the open workspace directory: {path}"),
                is_error: true,
            };
        };

        if let Some(parent) = target.parent() {
            if let Err(err) = fs::create_dir_all(parent).await {
                return ToolExecutionResult {
                    content: err.to_string(),
                    is_error: true,
                };
            }
        }

        let result = if mode == "append" {
            let mut file = match fs::OpenOptions::new()
                .create(true)
                .append(true)
                .open(&target)
                .await
            {
                Ok(file) => file,
                Err(err) => {
                    return ToolExecutionResult {
                        content: err.to_string(),
                        is_error: true,
                    }
                }
            };
            file.write_all(content.as_bytes()).await
        } else {
            fs::write(&target, content).await
        };

        match result {
            Ok(()) => {
                let relative = target
                    .strip_prefix(&self.workspace_root)
                    .unwrap_or(&target)
                    .display();
                ToolExecutionResult {
                    content: format!("{mode} wrote {} bytes to {relative}", content.len()),
                    is_error: false,
                }
            }
            Err(err) => ToolExecutionResult {
                content: err.to_string(),
                is_error: true,
            },
        }
    }
}

#[cfg(test)]
#[path = "../../../tests/plugins/builtin/write_file.rs"]
mod write_file_tests;
