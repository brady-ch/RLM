use axum::response::Html;

pub(crate) async fn ui_placeholder() -> Html<&'static str> {
    Html("<!doctype html><title>RLM UI</title><div id=\"root\">Build the React UI with npm run build:ui.</div>")
}
