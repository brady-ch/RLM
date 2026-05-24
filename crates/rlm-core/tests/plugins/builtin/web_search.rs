use super::*;

#[test]
fn builds_query_from_terms() {
    let query = build_search_query(&serde_json::json!({ "terms": ["rust", "plugins"] }));
    assert_eq!(query, "rust plugins");
}
