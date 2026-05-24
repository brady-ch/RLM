use super::*;

#[test]
fn sanitize_id_rejects_empty() {
    assert!(sanitize_id("  ").is_err());
    assert!(sanitize_id("..").is_err());
}

#[test]
fn sanitize_id_normalizes_unsafe_chars() {
    assert_eq!(sanitize_id("demo/session").unwrap(), "demo-session");
}
