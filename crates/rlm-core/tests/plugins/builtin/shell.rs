use super::*;

#[test]
fn rejects_blocked_operators() {
    let tool = GuardedShellTool::new(Path::new("."));
    assert!(tool.validate_command("ls | cat").is_err());
}

#[test]
fn allows_allowlisted_command() {
    let tool = GuardedShellTool::new(Path::new("."));
    assert!(tool.validate_command("pwd").is_ok());
}
