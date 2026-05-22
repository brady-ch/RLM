use std::fs;
use std::process::Command;

fn write_minimal_config(_dir: &tempfile::TempDir) {
    // Intentionally no project config — force QueueModel fixtures (avoids Ollama in CI/smoke).
}

fn rlm_cmd(dir: &tempfile::TempDir) -> Command {
    let mut cmd = Command::new(env!("CARGO_BIN_EXE_rlm"));
    cmd.env("RLM_FORCE_QUEUE_MODELS", "1");
    cmd
}

fn project_root_args(dir: &tempfile::TempDir) -> [&str; 2] {
    [
        "--project-root",
        dir.path().to_str().expect("path"),
    ]
}

#[test]
fn ask_returns_success_with_queue_fixture() {
    let dir = tempfile::tempdir().expect("tempdir");
    write_minimal_config(&dir);

    let mut args = vec!["ask", "Say hello"];
    args.extend_from_slice(&project_root_args(&dir));
    let output = rlm_cmd(&dir).args(args).output().expect("run ask");

    assert!(
        output.status.success(),
        "stderr: {}",
        String::from_utf8_lossy(&output.stderr)
    );
    let stdout = String::from_utf8_lossy(&output.stdout);
    assert!(!stdout.contains("stub"));
    assert!(!stdout.is_empty());
}

#[test]
fn ask_json_flag_emits_structured_output() {
    let dir = tempfile::tempdir().expect("tempdir");
    write_minimal_config(&dir);

    let mut args = vec!["ask", "Say hello", "--json"];
    args.extend_from_slice(&project_root_args(&dir));
    let output = rlm_cmd(&dir).args(args).output().expect("run ask json");

    assert!(output.status.success());
    let stdout = String::from_utf8_lossy(&output.stdout);
    assert!(stdout.contains("\"ok\""));
    assert!(stdout.contains("\"answer\""));
}

#[test]
fn plan_node_returns_planned_graph_json() {
    let dir = tempfile::tempdir().expect("tempdir");
    write_minimal_config(&dir);

    let mut args = vec!["plan-node", "--prompt", "Build a two-step checklist"];
    args.extend_from_slice(&project_root_args(&dir));
    let output = rlm_cmd(&dir).args(args).output().expect("run plan-node");

    assert!(
        output.status.success(),
        "stderr: {}",
        String::from_utf8_lossy(&output.stderr)
    );
    let stdout = String::from_utf8_lossy(&output.stdout);
    assert!(stdout.contains("plannedNodeIds"));
    assert!(stdout.contains("graphNodeCount"));
}

#[test]
fn workflow_export_import_round_trip() {
    let dir = tempfile::tempdir().expect("tempdir");
    write_minimal_config(&dir);
    let project = dir.path();

    let session_dir = project.join(".rlm/sessions/demo");
    fs::create_dir_all(&session_dir).expect("session dir");
    fs::write(
        session_dir.join("manifest.json"),
        r#"{"version":1,"id":"demo","name":"demo","createdAt":"2026-01-01T00:00:00Z","updatedAt":"2026-01-01T00:00:00Z","sections":{"session":{"file":"session.json","version":1},"runState":{"file":"run-state.json","version":1},"artifacts":{"file":"artifacts.json","version":1},"memory":{"file":"memory.json","version":1},"preferences":{"file":"preferences.json","version":1},"vectorIndex":{"file":"vector-index.json","version":1},"graphWorkflowMetadata":{"file":"graph-workflow-metadata.json","version":1}}}"#,
    )
    .expect("manifest");
    fs::write(
        session_dir.join("session.json"),
        r#"{"version":1,"data":{"graph":{"nodes":[{"id":"root-composer","kind":"composer","label":"Root","prompt":"Plan tasks","depth":0,"status":"ready"}],"edges":[]},"status":"planned"}}"#,
    )
    .expect("session");
    for file in [
        "run-state.json",
        "artifacts.json",
        "memory.json",
        "preferences.json",
        "vector-index.json",
        "graph-workflow-metadata.json",
    ] {
        fs::write(
            session_dir.join(file),
            r#"{"version":1,"data":{}}"#,
        )
        .expect("section");
    }

    let mut export_args = vec![
        "workflow-export",
        "--workflow",
        "demo-flow",
        "--export-session",
        "demo",
    ];
    export_args.extend_from_slice(&project_root_args(&dir));
    let export = rlm_cmd(&dir).args(export_args).output().expect("export");

    assert!(
        export.status.success(),
        "export stderr: {}",
        String::from_utf8_lossy(&export.stderr)
    );

    let mut import_args = vec!["workflow-import", "--workflow", "demo-flow"];
    import_args.extend_from_slice(&project_root_args(&dir));
    let import = rlm_cmd(&dir).args(import_args).output().expect("import");

    assert!(
        import.status.success(),
        "import stderr: {}",
        String::from_utf8_lossy(&import.stderr)
    );
    let stdout = String::from_utf8_lossy(&import.stdout);
    assert!(stdout.contains("nodeCount"));
}

#[test]
fn session_list_on_empty_store_returns_json() {
    let dir = tempfile::tempdir().expect("tempdir");
    write_minimal_config(&dir);

    let mut args = vec!["ask", "--session-list"];
    args.extend_from_slice(&project_root_args(&dir));
    let output = rlm_cmd(&dir).args(args).output().expect("session list");

    assert!(output.status.success());
    let stdout = String::from_utf8_lossy(&output.stdout);
    assert!(stdout.contains("sessions"));
}

#[test]
fn plan_node_stub_not_implemented_exit_removed() {
    let dir = tempfile::tempdir().expect("tempdir");
    write_minimal_config(&dir);

    let mut args = vec!["plan-node", "--prompt", "test"];
    args.extend_from_slice(&project_root_args(&dir));
    let output = rlm_cmd(&dir).args(args).output().expect("plan-node");

    assert_ne!(output.status.code(), Some(2));
    assert!(!String::from_utf8_lossy(&output.stderr).contains("not yet implemented"));
}
