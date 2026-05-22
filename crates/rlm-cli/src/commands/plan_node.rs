use std::sync::Arc;

use rlm_core::domain::recursion::preview;
use rlm_core::domain::types::{ExecutionGraphNode, ExecutionStatus, GraphPosition};
use rlm_core::execution::InteractiveExecutionSession;
use rlm_core::{prepare_cli_runtime, CliConfigOverrides};
use serde_json::json;

use crate::flags::CommandContext;

pub struct PlanNodeCommand;

impl PlanNodeCommand {
    pub async fn run(
        ctx: &CommandContext,
        prompt_parts: Vec<String>,
    ) -> Result<(), Box<dyn std::error::Error>> {
        let prompt = ctx
            .flags
            .prompt_flag
            .clone()
            .or_else(|| {
                let joined = prompt_parts.join(" ").trim().to_string();
                (!joined.is_empty()).then_some(joined)
            })
            .unwrap_or_else(|| {
                "Create a concise two-step checklist for testing recursive prompting in this workspace."
                    .to_string()
            });

        let overrides = config_overrides_from_flags(&ctx.flags);
        let prepared = tokio::task::spawn_blocking({
            let project_root = ctx.project_root.clone();
            let config_path = ctx.config_path.clone();
            let overrides = overrides.clone();
            move || prepare_cli_runtime(&project_root, config_path.as_deref(), &overrides)
        })
        .await
        .map_err(|err| -> Box<dyn std::error::Error> { err.into() })?
        .map_err(|err| -> Box<dyn std::error::Error> { err.into() })?;

        let node_id = ctx.flags.node_id.as_deref().unwrap_or("root-composer");
        let replan = ctx.flags.replan;
        let session = InteractiveExecutionSession::new(ctx.flags.resolved_approval_mode());
        seed_root_composer(&session, &prompt);

        match session
            .plan_node(node_id, replan, prepared.plan_model)
            .await
        {
            Ok(plan) => {
                let graph = session.snapshot().graph;
                println!(
                    "{}",
                    serde_json::to_string_pretty(&json!({
                        "plannedNodeIds": plan.planned_node_ids,
                        "budget": plan.budget,
                        "graphNodeCount": graph.nodes.len(),
                    }))?
                );
                Ok(())
            }
            Err(err) => {
                if let Some(mutation) = session.to_mutation_error(&err) {
                    eprintln!("{}", serde_json::to_string_pretty(&mutation)?);
                } else {
                    eprintln!(
                        "{}",
                        serde_json::to_string_pretty(&json!({ "error": err }))?
                    );
                }
                std::process::exit(1);
            }
        }
    }
}

fn seed_root_composer(session: &Arc<InteractiveExecutionSession>, prompt: &str) {
    session.register_node_for_test(ExecutionGraphNode {
        id: "root-composer".into(),
        kind: "composer".into(),
        label: preview(prompt, 80),
        prompt: Some(prompt.to_string()),
        original_prompt: Some(prompt.to_string()),
        depth: 0,
        status: ExecutionStatus::Ready,
        position: Some(GraphPosition { x: 0.0, y: 0.0 }),
        composer: Some(json!({ "type": "composer", "prompt": prompt })),
        editable_fields: Some(vec!["prompt".into()]),
        ..Default::default()
    });
}

fn config_overrides_from_flags(flags: &crate::flags::ExecutionFlags) -> CliConfigOverrides {
    CliConfigOverrides {
        max_depth: flags.depth,
        max_dynamic_depth: flags.max_depth,
        max_branches: flags.branches,
        max_prompt_characters: flags.max_prompt_chars,
        max_model_calls: flags.max_model_calls,
        max_tool_rounds: flags.max_tool_rounds,
        quality_loop: flags.quality_loop,
        quality_loop_max_iterations: flags.quality_loop_max_iterations,
    }
}
