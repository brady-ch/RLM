use super::*;
use crate::ports::LanguageModelToolDefinition;
use serde_json::json;

fn sample_tools() -> Vec<LanguageModelToolDefinition> {
    vec![
        LanguageModelToolDefinition {
            name: "shell".into(),
            description: "Run shell".into(),
            schema: json!({"type": "object", "properties": {"command": {"type": "string"}}}),
        },
        LanguageModelToolDefinition {
            name: "write_file".into(),
            description: "Write file".into(),
            schema: json!({"type": "object", "properties": {"path": {"type": "string"}}}),
        },
    ]
}

fn tool_names_in_schema(schema: &serde_json::Value) -> Vec<String> {
    schema
        .pointer("/properties/choice/oneOf")
        .and_then(|one_of| one_of.as_array())
        .map(|branches| {
            branches
                .iter()
                .filter_map(|branch| {
                    branch
                        .pointer("/properties/tool/const")
                        .and_then(|v| v.as_str())
                        .map(str::to_string)
                })
                .collect()
        })
        .unwrap_or_default()
}

#[test]
fn build_tool_envelope_schema_includes_registered_tool_names() {
    let tools = sample_tools();
    let schema = build_tool_envelope_schema(&tools);
    let mut names = tool_names_in_schema(&schema);
    names.sort();
    assert_eq!(names, vec!["shell", "write_file"]);
}

#[test]
fn parse_valid_final_envelope() {
    let content = r#"{"choice":{"kind":"final","final":"done"}}"#;
    let result = parse_envelope_response(content, &sample_tools()).expect("parse");
    assert_eq!(result, ParsedEnvelope::Final("done".into()));
}

#[test]
fn parse_valid_tool_call_envelope() {
    let content =
        r#"{"choice":{"kind":"tool_call","tool":"shell","args":{"command":"echo hi"}}}"#;
    let result = parse_envelope_response(content, &sample_tools()).expect("parse");
    assert_eq!(
        result,
        ParsedEnvelope::ToolCall {
            name: "shell".into(),
            args: json!({"command": "echo hi"}),
        }
    );
}

#[test]
fn parse_unknown_tool_rejected() {
    let content = r#"{"choice":{"kind":"tool_call","tool":"evil","args":{}}}"#;
    let err = parse_envelope_response(content, &sample_tools()).unwrap_err();
    assert_eq!(err, EnvelopeError::UnknownTool("evil".into()));
}

#[test]
fn parse_invalid_json_rejected() {
    let err = parse_envelope_response("not json", &sample_tools()).unwrap_err();
    assert!(matches!(err, EnvelopeError::InvalidJson(_)));
}
