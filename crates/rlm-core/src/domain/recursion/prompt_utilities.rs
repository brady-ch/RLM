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
#[path = "../../../tests/domain/recursion/prompt_utilities.rs"]
mod prompt_utilities_tests;
