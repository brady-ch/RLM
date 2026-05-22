use std::path::PathBuf;
use std::sync::Arc;

use rlm_core::{prepare_ask_execution, InMemoryTrace, RecursiveLanguageModel};

pub async fn run(
    prompt: Vec<String>,
    json: bool,
    project_root: PathBuf,
    config_path: Option<PathBuf>,
) -> Result<(), Box<dyn std::error::Error>> {
    let text = prompt.join(" ").trim().to_string();
    if text.is_empty() {
        return Err("Missing prompt. Example: rlm ask \"Summarize this repo.\"".into());
    }

    let prepared = prepare_ask_execution(&project_root, config_path.as_deref())
        .map_err(|err| -> Box<dyn std::error::Error> { err.into() })?;

    let trace = Arc::new(InMemoryTrace::new());
    let engine =
        RecursiveLanguageModel::new(prepared.exec_model, trace, prepared.runtime_context.tools);
    let result = engine
        .run(&text, prepared.runtime_config, None)
        .await
        .map_err(|err| -> Box<dyn std::error::Error> { err.into() })?;

    if json {
        println!(
            "{}",
            serde_json::json!({
                "ok": true,
                "answer": result.answer,
                "executionStatus": result.metadata.execution_status,
                "modelCalls": result.metadata.model_calls,
                "errors": result.metadata.errors,
            })
        );
    } else {
        println!("{}", result.answer);
    }

    Ok(())
}
