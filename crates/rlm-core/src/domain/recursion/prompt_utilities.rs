use crate::domain::types::{ChatMessage, RecursiveModelConfig, TaskNode};

pub fn preview(value: &str, max_length: usize) -> String {
    let normalized: String = value.split_whitespace().collect::<Vec<_>>().join(" ");
    if normalized.len() <= max_length {
        normalized
    } else {
        format!("{}...", &normalized[..max_length.saturating_sub(3)])
    }
}

pub fn parse_clarification_request(value: &str) -> Option<String> {
    let trimmed = value.trim();
    let upper = trimmed.to_uppercase();
    if let Some(rest) = upper.strip_prefix("CLARIFY:") {
        let original_rest = &trimmed[trimmed.len() - rest.len()..];
        let answer = original_rest.trim();
        if answer.is_empty() {
            None
        } else {
            Some(answer.to_string())
        }
    } else if let Some(idx) = upper.find("CLARIFY:") {
        let rest = trimmed[idx + "CLARIFY:".len()..].trim();
        if rest.is_empty() {
            None
        } else {
            Some(rest.to_string())
        }
    } else {
        None
    }
}

pub fn parse_first_integer(value: &str) -> Option<i32> {
    value
        .split_whitespace()
        .find_map(|token| token.parse::<i32>().ok())
        .or_else(|| {
            value
                .chars()
                .filter(|c| c.is_ascii_digit())
                .collect::<String>()
                .parse()
                .ok()
        })
}

pub fn is_code_task(task: &TaskNode) -> bool {
    if task.kind.as_deref() == Some("code") {
        return true;
    }
    let normalized = task.prompt.trim().to_lowercase();
    normalized.starts_with("code:") || normalized.starts_with("run code:")
}

pub fn clamp(value: i32, min: i32, max: i32) -> i32 {
    value.max(min).min(max)
}

pub fn fallback_from_messages(messages: &[ChatMessage]) -> String {
    messages
        .iter()
        .rev()
        .find(|m| m.role == "user")
        .map(|m| m.content.trim().to_string())
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| "No additional model calls are available.".into())
}

pub fn to_model_purpose(kind: &str) -> Option<&str> {
    match kind {
        "depth" | "classify" | "decompose" | "answer" | "summarize" | "synthesize" => Some(kind),
        _ => None,
    }
}

pub fn limit_prompt(prompt: &str, config: &RecursiveModelConfig) -> String {
    if prompt.len() <= config.max_prompt_characters {
        prompt.to_string()
    } else {
        prompt[..config.max_prompt_characters]
            .trim_end()
            .to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

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
        }));
        assert!(is_code_task(&TaskNode {
            id: "n".into(),
            parent_id: None,
            prompt: "Code: do it".into(),
            depth: 0,
            kind: None,
            model_override: None,
        }));
        assert!(!is_code_task(&TaskNode {
            id: "n".into(),
            parent_id: None,
            prompt: "plain".into(),
            depth: 0,
            kind: None,
            model_override: None,
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
            },
            ChatMessage {
                role: "user".into(),
                content: "last".into(),
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
}
