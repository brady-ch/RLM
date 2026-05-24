use std::collections::HashSet;

use super::*;

#[test]
fn init_order_matches_v17_pipeline() {
    let temp = tempfile::tempdir().expect("tempdir");
    let ctx = build_runtime_context(BuildRuntimeContextInput {
        project_root: temp.path(),
        project_config: None,
        on_init_stage: None,
    })
    .expect("runtime");
    assert_eq!(ctx.init_stages, COMPOSITION_INIT_ORDER);
}

#[test]
fn loads_builtin_tools() {
    let temp = tempfile::tempdir().expect("tempdir");
    let ctx = build_runtime_context(BuildRuntimeContextInput {
        project_root: temp.path(),
        project_config: None,
        on_init_stage: None,
    })
    .expect("runtime");
    let names: HashSet<_> = ctx.tools.iter().map(|t| t.name().to_string()).collect();
    assert!(names.contains("shell"));
    assert!(names.contains("write_file"));
    assert!(names.contains("web_search"));
    assert!(names.contains("web_fetch"));
    assert!(names.contains("skill"));
}
