use super::*;

#[test]
fn extracts_title_from_html() {
    assert_eq!(
        extract_title("<html><title>Hello</title></html>").as_deref(),
        Some("Hello")
    );
}
