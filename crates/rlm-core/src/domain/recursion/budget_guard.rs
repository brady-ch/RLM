use crate::domain::types::RecursiveModelConfig;

pub fn remaining_model_calls(model_calls: u32, max_model_calls: u32) -> u32 {
    max_model_calls.saturating_sub(model_calls)
}

pub fn can_spend_any_model_call(model_calls: u32, max_model_calls: u32) -> bool {
    model_calls < max_model_calls
}

pub fn max_tool_rounds_from_limit(tool_round_limit: i32) -> u32 {
    tool_round_limit.max(0) as u32
}

pub fn has_call_reserved_for_direct_answer(model_calls: u32, config_max_model_calls: u32) -> bool {
    model_calls < config_max_model_calls.saturating_sub(1)
}

pub fn estimate_model_calls(config: Option<&RecursiveModelConfig>, model_calls_used: u32) -> u32 {
    let Some(config) = config else {
        return model_calls_used.max(1);
    };

    let depth = config.max_depth.unwrap_or(config.max_dynamic_depth);
    let branch_factor = config.max_branches.max(1) as u64;
    let max_nodes = if depth <= 0 {
        1
    } else {
        let depth = depth as u32;
        ((branch_factor.pow(depth + 1) - 1) / (branch_factor - 1).max(1)) as u32
    };
    (1 + max_nodes * 4).min(config.max_model_calls)
}

pub fn estimate_tool_rounds(tool_round_limit: u32, config: Option<&RecursiveModelConfig>) -> u32 {
    config
        .map(|c| c.max_tool_rounds)
        .unwrap_or(tool_round_limit)
}

#[cfg(test)]
mod tests {
    use super::*;

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
}
