use super::*;
use crate::domain::types::RecursiveModelConfig;

fn base_config(overrides: RecursiveModelConfig) -> RecursiveModelConfig {
    overrides
}

#[test]
fn remaining_and_spend_gate() {
    assert_eq!(remaining_model_calls(2, 5), 3);
    assert!(can_spend_any_model_call(4, 5));
    assert!(!can_spend_any_model_call(5, 5));
}

#[test]
fn max_tool_rounds_from_limit_clamps() {
    assert_eq!(max_tool_rounds_from_limit(3), 3);
    assert_eq!(max_tool_rounds_from_limit(-1), 0);
}

#[test]
fn reserved_direct_answer_headroom() {
    assert!(has_call_reserved_for_direct_answer(0, 100));
    assert!(has_call_reserved_for_direct_answer(98, 100));
    assert!(!has_call_reserved_for_direct_answer(99, 100));
}

#[test]
fn estimate_model_calls_from_depth() {
    let config = base_config(RecursiveModelConfig {
        max_depth: Some(0),
        max_dynamic_depth: 0,
        max_branches: 4,
        max_prompt_characters: 4096,
        max_model_calls: 50,
        max_tool_rounds: 0,
        quality_loop: None,
    });
    assert_eq!(estimate_model_calls(Some(&config), 0), 5);
}

#[test]
fn estimate_tool_rounds_prefers_config() {
    assert_eq!(estimate_tool_rounds(2, None), 2);
    let config = RecursiveModelConfig {
        max_depth: None,
        max_dynamic_depth: 0,
        max_branches: 4,
        max_prompt_characters: 4096,
        max_model_calls: 10_000,
        max_tool_rounds: 3,
        quality_loop: None,
    };
    assert_eq!(estimate_tool_rounds(99, Some(&config)), 3);
}
