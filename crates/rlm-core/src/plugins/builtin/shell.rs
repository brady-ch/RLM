use std::collections::HashSet;
use std::path::{Path, PathBuf};

use async_trait::async_trait;
use tokio::process::Command;

use crate::plugins::tool_schemas;
use crate::ports::Tool;
use crate::ports::ToolExecutionResult;

const DEFAULT_ALLOWED: &[&str] = &["pwd", "ls", "rg", "sed", "cat"];
const BLOCKED_TOKENS: &[&str] = &["|", "&&", "||", ";", ">", ">>", "<", "$(", "`"];

pub struct GuardedShellTool {
    workspace_root: PathBuf,
    allowed_commands: HashSet<String>,
}

impl GuardedShellTool {
    pub fn new(workspace_root: &Path) -> Self {
        Self {
            workspace_root: workspace_root
                .canonicalize()
                .unwrap_or_else(|_| workspace_root.to_path_buf()),
            allowed_commands: DEFAULT_ALLOWED.iter().map(|s| (*s).to_string()).collect(),
        }
    }

    fn validate_command(&self, command: &str) -> Result<(), String> {
        let command = command.trim();
        if command.is_empty() {
            return Err("Empty command.".into());
        }
        if contains_blocked_shell_syntax(command) {
            return Err(
                "Shell control operators, redirection, command substitution, and environment assignment are not allowed.".into(),
            );
        }
        let parts = parse_command(command);
        let executable = parts.first().map(String::as_str).unwrap_or("");
        if executable.is_empty() || !self.allowed_commands.contains(executable) {
            return Err(format!("Command is not allowlisted: {executable}"));
        }
        for arg in parts.iter().skip(1) {
            if arg.contains('*') || arg.contains('?') {
                return Err("Glob arguments are not allowed.".into());
            }
            if looks_like_path(arg) && !is_workspace_path(&self.workspace_root, arg) {
                return Err(format!("Path is outside the workspace: {arg}"));
            }
        }
        Ok(())
    }
}

#[async_trait]
impl Tool for GuardedShellTool {
    fn name(&self) -> &str {
        "shell"
    }

    fn description(&self) -> &str {
        "Run an allowlisted, read-only shell command in the workspace. Use for inspecting files and searching text."
    }

    fn schema(&self) -> serde_json::Value {
        tool_schemas::shell_schema()
    }

    async fn execute(&self, arguments: serde_json::Value) -> ToolExecutionResult {
        let command = arguments
            .get("command")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .trim()
            .to_string();
        if command.is_empty() {
            return error_result("Missing or empty command.");
        }
        if let Err(message) = self.validate_command(&command) {
            return error_result(&message);
        }
        let parts = parse_command(&command);
        let executable = parts[0].clone();
        let args: Vec<&str> = parts.iter().skip(1).map(String::as_str).collect();
        match Command::new(&executable)
            .args(&args)
            .current_dir(&self.workspace_root)
            .output()
            .await
        {
            Ok(output) => ToolExecutionResult {
                content: format_shell_output(
                    &String::from_utf8_lossy(&output.stdout),
                    &String::from_utf8_lossy(&output.stderr),
                    output.status.code().unwrap_or(1),
                ),
                is_error: !output.status.success(),
            },
            Err(err) => error_result(&err.to_string()),
        }
    }
}

fn error_result(message: &str) -> ToolExecutionResult {
    ToolExecutionResult {
        content: message.to_string(),
        is_error: true,
    }
}

fn parse_command(command: &str) -> Vec<String> {
    let mut parts = Vec::new();
    let mut current = String::new();
    let mut quote: Option<char> = None;
    for ch in command.chars() {
        if quote.is_none() && (ch == '"' || ch == '\'') {
            quote = Some(ch);
            continue;
        }
        if Some(ch) == quote {
            quote = None;
            continue;
        }
        if ch.is_whitespace() && quote.is_none() {
            if !current.is_empty() {
                parts.push(std::mem::take(&mut current));
            }
            continue;
        }
        current.push(ch);
    }
    if !current.is_empty() {
        parts.push(current);
    }
    parts
}

fn contains_blocked_shell_syntax(command: &str) -> bool {
    if command
        .trim_start()
        .chars()
        .next()
        .is_some_and(|c| c.is_ascii_alphabetic())
    {
        if let Some(eq) = command.find('=') {
            let prefix = &command[..eq];
            if prefix
                .trim()
                .chars()
                .all(|c| c.is_ascii_alphanumeric() || c == '_')
                && command.trim_start().starts_with(prefix.trim())
            {
                return true;
            }
        }
    }
    BLOCKED_TOKENS.iter().any(|token| command.contains(token))
}

fn looks_like_path(arg: &str) -> bool {
    arg.starts_with('/') || arg.starts_with('.') || arg.contains('/')
}

fn is_workspace_path(workspace_root: &Path, path: &str) -> bool {
    let resolved = workspace_root.join(path);
    let resolved = resolved.canonicalize().unwrap_or(resolved);
    resolved.starts_with(workspace_root)
}

fn format_shell_output(stdout: &str, stderr: &str, exit_code: i32) -> String {
    format!(
        "exitCode: {exit_code}\nstdout:\n{}\nstderr:\n{}",
        stdout.trim(),
        stderr.trim()
    )
}

#[cfg(test)]
#[path = "../../../tests/plugins/builtin/shell.rs"]
mod shell_tests;
