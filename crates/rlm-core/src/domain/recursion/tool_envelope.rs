use serde::Deserialize;
use serde_json::{json, Value};
use thiserror::Error;

use crate::ports::LanguageModelToolDefinition;

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ParsedEnvelope {
    Final(String),
    ToolCall { name: String, args: Value },
}

#[derive(Debug, Error, PartialEq, Eq)]
pub enum EnvelopeError {
    #[error("invalid envelope JSON: {0}")]
    InvalidJson(String),
    #[error("invalid envelope structure: {0}")]
    InvalidStructure(String),
    #[error("unknown tool: {0}")]
    UnknownTool(String),
}

pub fn build_tool_envelope_schema(tools: &[LanguageModelToolDefinition]) -> Value {
    let tool_branches: Vec<Value> = tools
        .iter()
        .map(|tool| {
            json!({
                "type": "object",
                "additionalProperties": false,
                "required": ["kind", "tool", "args"],
                "properties": {
                    "kind": { "const": "tool_call" },
                    "tool": { "const": tool.name },
                    "args": tool.schema.clone(),
                }
            })
        })
        .collect();

    let mut one_of = vec![json!({
        "type": "object",
        "additionalProperties": false,
        "required": ["kind", "final"],
        "properties": {
            "kind": { "const": "final" },
            "final": { "type": "string" }
        }
    })];
    one_of.extend(tool_branches);

    json!({
        "type": "object",
        "additionalProperties": false,
        "required": ["choice"],
        "properties": {
            "choice": {
                "oneOf": one_of
            }
        }
    })
}

#[derive(Debug, Deserialize)]
struct EnvelopeRoot {
    choice: EnvelopeChoice,
}

#[derive(Debug, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
enum EnvelopeChoice {
    Final {
        #[serde(rename = "final")]
        final_text: String,
    },
    ToolCall {
        tool: String,
        args: Value,
    },
}

pub fn parse_envelope_response(
    content: &str,
    allowed_tools: &[LanguageModelToolDefinition],
) -> Result<ParsedEnvelope, EnvelopeError> {
    let root: EnvelopeRoot = serde_json::from_str(content).map_err(|err| {
        EnvelopeError::InvalidJson(err.to_string())
    })?;

    match root.choice {
        EnvelopeChoice::Final { final_text } => Ok(ParsedEnvelope::Final(final_text)),
        EnvelopeChoice::ToolCall { tool, args } => {
            if !allowed_tools.iter().any(|t| t.name == tool) {
                return Err(EnvelopeError::UnknownTool(tool));
            }
            Ok(ParsedEnvelope::ToolCall { name: tool, args })
        }
    }
}

#[cfg(test)]
#[path = "../../../tests/domain/recursion/tool_envelope.rs"]
mod tool_envelope_tests;
