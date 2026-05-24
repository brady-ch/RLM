use super::*;
use std::fs;

#[test]
fn parse_yaml_includes_path_context() {
    let dir = std::env::temp_dir().join(format!("rlm-config-{}", std::process::id()));
    let _ = fs::remove_dir_all(&dir);
    fs::create_dir_all(&dir).unwrap();
    let path = dir.join("bad.yaml");
    fs::write(&path, ":\n- not a map\n").unwrap();
    let err = parse_yaml_file(&path).unwrap_err();
    assert!(err.to_string().contains(&path.display().to_string()));
}
