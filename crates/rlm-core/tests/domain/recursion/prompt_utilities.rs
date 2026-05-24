use super::*;
use crate::domain::types::{ChatMessage, RecursiveModelConfig, TaskNode};

#[test]
fn preview_trims_and_ellipsizes() {
    assert_eq!(preview("  hello   world ", 180), "hello world");
    let long = "a".repeat(200);
    let out = preview(&long, 20);
    assert!(out.ends_with("..."));
    assert_eq!(out.len(), 20);
}

#[test]
fn parse_clarification_request_extracts_payload() {
    assert_eq!(
        super::parse_clarification_request("CLARIFY: what color?"),
        Some("what color?".into())
    );
    assert_eq!(super::parse_clarification_request("not clarify"), None);
}

#[test]
fn parse_first_integer_finds_digit() {
    assert_eq!(parse_first_integer("depth 3 branches"), Some(3));
    assert_eq!(parse_first_integer("no digits"), None);
}

#[test]
fn is_code_task_recognizes_kind_and_prefixes() {
    assert!(is_code_task(&TaskNode {
        id: "n".into(),
        parent_id: None,
        prompt: "plain".into(),
        depth: 0,
        kind: Some("code".into()),
        model_override: None,
        context_policy: None
    }));
    assert!(is_code_task(&TaskNode {
        id: "n".into(),
        parent_id: None,
        prompt: "Code: do it".into(),
        depth: 0,
        kind: None,
        model_override: None,
        context_policy: None
    }));
    assert!(!is_code_task(&TaskNode {
        id: "n".into(),
        parent_id: None,
        prompt: "plain".into(),
        depth: 0,
        kind: None,
        model_override: None,
        context_policy: None
    }));
}

#[test]
fn clamp_range() {
    assert_eq!(clamp(5, 0, 10), 5);
    assert_eq!(clamp(-1, 0, 10), 0);
    assert_eq!(clamp(99, 0, 10), 10);
}

#[test]
fn fallback_from_messages_uses_last_user() {
    let msgs = vec![
        ChatMessage {
            role: "assistant".into(),
            content: "hi".into(),
            ..Default::default()
        },
        ChatMessage {
            role: "user".into(),
            content: "last".into(),
            ..Default::default()
        },
    ];
    assert_eq!(fallback_from_messages(&msgs), "last");
}

#[test]
fn limit_prompt_truncates() {
    let config = RecursiveModelConfig {
        max_depth: None,
        max_dynamic_depth: 0,
        max_branches: 4,
        max_prompt_characters: 10,
        max_model_calls: 50,
        max_tool_rounds: 0,
        quality_loop: None,
    };
    assert_eq!(limit_prompt("abc", &config), "abc");
    let tiny = RecursiveModelConfig {
        max_prompt_characters: 3,
        ..config
    };
    assert_eq!(limit_prompt("abcdefghij", &tiny), "abc");
}
