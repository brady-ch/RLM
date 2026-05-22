use std::fs;
use std::process::Command;

#[test]
fn ask_returns_success_with_queue_fixture() {
    let dir = tempfile::tempdir().expect("tempdir");
    let config_path = dir.path().join("rlm.config.yaml");
    fs::write(
        &config_path,
        r#"
models:
  default: test-model
memory:
  enabled: false
runtime:
  maxDepth: 1
  maxModelCalls: 5
  maxToolRounds: 2
agents:
  default:
    tools: []
workflows: {}
hosts: {}
interop:
  mcp:
    servers: []
  skills:
    searchPaths: []
    duplicateStrategy: first_match
    cache: false
    pathPolicies: []
"#,
    )
    .expect("write config");

    let output = Command::new(env!("CARGO_BIN_EXE_rlm"))
        .args([
            "ask",
            "Say hello",
            "--project-root",
            dir.path().to_str().expect("path"),
            "--config",
            config_path.to_str().expect("config"),
        ])
        .output()
        .expect("run ask");

    assert!(
        output.status.success(),
        "stderr: {}",
        String::from_utf8_lossy(&output.stderr)
    );
    let stdout = String::from_utf8_lossy(&output.stdout);
    assert!(!stdout.contains("stub"));
    assert!(!stdout.is_empty());
}
