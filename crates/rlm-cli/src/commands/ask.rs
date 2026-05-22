use std::io::{self, BufRead, Write};
use std::sync::Arc;

use rlm_core::domain::recursive_language_model::ExecutionControl;
use rlm_core::domain::types::ExecutionStatus;
use rlm_core::execution::InteractiveExecutionSession;
use rlm_core::graph::{
    apply_pipeline_template, build_import_session_snapshot, execute_graph, import_sidecar_to_graph,
    load_graph_workflow, GraphExecutorInput,
};
use rlm_core::{
    prepare_cli_runtime, CliConfigOverrides, InMemoryTrace, RecursiveLanguageModel,
};
use serde_json::json;

use crate::exec_control::CliExecutionControl;
use crate::flags::CommandContext;

pub async fn run(ctx: &CommandContext, prompt_parts: Vec<String>) -> Result<(), Box<dyn std::error::Error>> {
    let text = ctx
        .flags
        .prompt_flag
        .clone()
        .or_else(|| {
            let joined = prompt_parts.join(" ").trim().to_string();
            (!joined.is_empty()).then_some(joined)
        })
        .ok_or("Missing prompt. Example: rlm ask \"Summarize this repo.\"")?;

    if ctx.flags.workflow.is_some() {
        return run_workflow(ctx, &text).await;
    }

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

    let plan_only = ctx.flags.plan_only;
    let require_approval = ctx.flags.require_approval && !ctx.flags.approve;

    if require_approval {
        let plan_result = run_engine(
            &text,
            &prepared,
            Arc::new(CliExecutionControl::plan_only()),
        )
        .await?;
        print_ask_result(&plan_result, ctx)?;
        if !ctx.flags.approve {
            wait_for_approval()?;
        }
    } else if plan_only {
        let plan_result = run_engine(
            &text,
            &prepared,
            Arc::new(CliExecutionControl::plan_only()),
        )
        .await?;
        print_ask_result(&plan_result, ctx)?;
        return Ok(());
    }

    let control = Arc::new(CliExecutionControl::execute(ctx.flags.approve));
    let result = run_engine(&text, &prepared, control).await?;
    print_ask_result(&result, ctx)?;

    if result.metadata.execution_status == Some(ExecutionStatus::Failed)
        || !result.metadata.errors.is_empty()
    {
        std::process::exit(1);
    }
    Ok(())
}

async fn run_engine(
    prompt: &str,
    prepared: &rlm_core::CliRuntime,
    control: Arc<dyn ExecutionControl>,
) -> Result<rlm_core::domain::types::RecursivePromptResult, Box<dyn std::error::Error>> {
    let trace = Arc::new(InMemoryTrace::new());
    let engine = RecursiveLanguageModel::new(
        Arc::clone(&prepared.exec_model),
        trace,
        prepared.runtime_context.tools.clone(),
    );
    engine
        .run(prompt, prepared.runtime_config.clone(), Some(control))
        .await
        .map_err(|err| -> Box<dyn std::error::Error> { err.into() })
}

async fn run_workflow(ctx: &CommandContext, prompt: &str) -> Result<(), Box<dyn std::error::Error>> {
    let workflow_id = ctx
        .flags
        .workflow
        .as_deref()
        .ok_or("Missing --workflow <id>.")?
        .trim();
    let variant = ctx.flags.variant.as_deref().unwrap_or("playbook");

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

    let sidecar = load_graph_workflow(&ctx.project_root, workflow_id).map_err(|err| err.to_string())?;
    let mut graph = import_sidecar_to_graph(&sidecar, variant).map_err(|err| err.to_string())?;
    if variant == "pipeline" {
        graph = apply_pipeline_template(graph, prompt).map_err(|err| err.to_string())?;
    }

    let session = InteractiveExecutionSession::new(ctx.flags.resolved_approval_mode());
    session.restore_snapshot(build_import_session_snapshot(graph));
    session.begin_confirmed_execution();

    let exec_model = Arc::clone(&prepared.exec_model);
    let runtime = prepared.runtime_context.clone();
    let input = GraphExecutorInput {
        runtime_config: prepared.runtime_config.clone(),
        project_config: Some(prepared.project_config.config.clone()),
        create_model: Arc::new(move || Arc::clone(&exec_model) as Arc<dyn rlm_core::ports::LanguageModel>),
        runtime: Some(runtime),
        run_state: None,
        resume: false,
    };
    execute_graph(Arc::clone(&session), input)
        .await
        .map_err(|err| err.message)?;

    let snapshot = session.snapshot();
    let output = json!({
        "ok": true,
        "workflowId": workflow_id,
        "variant": variant,
        "executionStatus": snapshot.status,
        "nodeCount": snapshot.graph.nodes.len(),
        "runSummary": snapshot.run_summary,
    });
    if ctx.json {
        println!("{}", serde_json::to_string_pretty(&output)?);
    } else if let Some(summary) = snapshot.run_summary.and_then(|s| s.message) {
        println!("{summary}");
    } else {
        println!("{}", serde_json::to_string_pretty(&output)?);
    }
    Ok(())
}

fn print_ask_result(
    result: &rlm_core::domain::types::RecursivePromptResult,
    ctx: &CommandContext,
) -> Result<(), Box<dyn std::error::Error>> {
    if ctx.json {
        println!(
            "{}",
            serde_json::to_string_pretty(&json!({
                "ok": true,
                "answer": result.answer,
                "executionStatus": result.metadata.execution_status,
                "modelCalls": result.metadata.model_calls,
                "errors": result.metadata.errors,
            }))?
        );
    } else if ctx.flags.compact {
        println!(
            "modelCalls={} executionStatus={:?}\nanswer: {}",
            result.metadata.model_calls,
            result.metadata.execution_status,
            result.answer
        );
    } else {
        println!("{}", result.answer);
    }
    Ok(())
}

fn wait_for_approval() -> Result<(), Box<dyn std::error::Error>> {
    let stderr = io::stderr();
    let mut err = stderr.lock();
    err.write_all(
        b"Plan generated. Type 'run' and press Enter to execute, or Ctrl+C to cancel.\n",
    )?;
    err.flush()?;
    let stdin = io::stdin();
    let mut lines = stdin.lock().lines();
    while let Some(line) = lines.next() {
        let text = line?.trim().to_lowercase();
        if matches!(text.as_str(), "run" | "yes" | "y") {
            return Ok(());
        }
        err.write_all(b"Waiting for approval: type 'run' to continue.\n")?;
        err.flush()?;
    }
    Ok(())
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
