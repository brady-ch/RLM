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
#[path = "../../../tests/domain/recursion/budget_guard.rs"]
mod budget_guard_tests;
