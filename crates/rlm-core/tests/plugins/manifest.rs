use super::*;

#[test]
fn validates_minimal_manifest() {
    let raw = r#"{
        "id": "demo.test",
        "name": "Demo",
        "version": "1.0.0",
        "category": "shell",
        "engines": { "rlm": ">=1.0.0" }
    }"#;
    let manifest = parse_plugin_manifest(raw, "test").expect("valid");
    assert_eq!(manifest.id, "demo.test");
    assert!(manifest.contributes.tools.is_empty());
}

#[test]
fn rejects_missing_id() {
    let raw = r#"{ "name": "Demo", "version": "1.0.0", "category": "shell", "engines": { "rlm": ">=1.0.0" } }"#;
    assert!(parse_plugin_manifest(raw, "test").is_err());
}
