pub fn run(prompt: Vec<String>, json: bool) -> Result<(), Box<dyn std::error::Error>> {
    let text = prompt.join(" ").trim().to_string();
    if text.is_empty() {
        return Err("Missing prompt. Example: rlm ask \"Summarize this repo.\"".into());
    }

    let message = "Rust ask mode is a stub during migration. \
                   Set RLM_RUNTIME=node for full recursive execution, \
                   or use `rlm ui` with the Rust control server.";

    if json {
        println!(
            "{}",
            serde_json::json!({
                "ok": false,
                "stub": true,
                "error": message,
                "prompt": text,
            })
        );
    } else {
        eprintln!("{message}");
        eprintln!("Prompt received: {text}");
    }

    std::process::exit(2);
}
