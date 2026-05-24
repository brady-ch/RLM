use super::*;

#[tokio::test]
async fn rejects_path_outside_workspace() {
    let temp = tempfile::tempdir().expect("tempdir");
    let tool = WorkspaceFileWriteTool::new(temp.path());
    let result = tool
        .execute(serde_json::json!({ "path": "../outside.txt", "content": "x" }))
        .await;
    assert!(result.is_error);
}
