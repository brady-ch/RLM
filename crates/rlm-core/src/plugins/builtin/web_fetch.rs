use std::time::Duration;

use async_trait::async_trait;
use reqwest::Client;

use crate::domain::types::ToolExecutionResult;
use crate::ports::Tool;

pub struct WebFetchTool {
    client: Client,
}

impl WebFetchTool {
    pub fn new() -> Self {
        Self {
            client: Client::builder()
                .timeout(Duration::from_secs(10))
                .user_agent("recursive-language-model/1.0")
                .build()
                .unwrap_or_else(|_| Client::new()),
        }
    }
}

impl Default for WebFetchTool {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl Tool for WebFetchTool {
    fn name(&self) -> &str {
        "web_fetch"
    }

    async fn execute(&self, arguments: serde_json::Value) -> ToolExecutionResult {
        let url = arguments.get("url").and_then(|v| v.as_str()).unwrap_or("");
        if url.is_empty() || !url.starts_with("http://") && !url.starts_with("https://") {
            return ToolExecutionResult {
                content: "Invalid or missing url.".into(),
                is_error: true,
            };
        }
        let query = arguments
            .get("query")
            .and_then(|v| v.as_str())
            .unwrap_or("");
        let max_sections = arguments
            .get("maxSections")
            .and_then(|v| v.as_u64())
            .unwrap_or(5)
            .min(10) as usize;

        let response = match self.client.get(url).send().await {
            Ok(resp) => resp,
            Err(err) => {
                return ToolExecutionResult {
                    content: err.to_string(),
                    is_error: true,
                }
            }
        };
        if !response.status().is_success() {
            return ToolExecutionResult {
                content: format!("web_fetch failed with HTTP {}.", response.status()),
                is_error: true,
            };
        }
        let content_type = response
            .headers()
            .get("content-type")
            .and_then(|v| v.to_str().ok())
            .unwrap_or("");
        if !content_type.contains("text/html")
            && !content_type.contains("text/plain")
            && !content_type.contains("application/xhtml+xml")
        {
            return ToolExecutionResult {
                content: format!(
                    "web_fetch only supports HTML or plain text responses. Received: {}",
                    if content_type.is_empty() {
                        "unknown"
                    } else {
                        content_type
                    }
                ),
                is_error: true,
            };
        }
        let body = match response.text().await {
            Ok(text) => text,
            Err(err) => {
                return ToolExecutionResult {
                    content: err.to_string(),
                    is_error: true,
                }
            }
        };
        let analysis = analyze_html(&body, query, max_sections);
        ToolExecutionResult {
            content: serde_json::json!({
                "url": url,
                "title": analysis.title,
                "selected": analysis.selected,
                "tree": analysis.tree,
            })
            .to_string(),
            is_error: false,
        }
    }
}

struct HtmlAnalysis {
    title: String,
    selected: Vec<String>,
    tree: Vec<String>,
}

fn analyze_html(html: &str, query: &str, max_sections: usize) -> HtmlAnalysis {
    let title = extract_title(html).unwrap_or_else(|| "Untitled".into());
    let text = strip_tags(html);
    let paragraphs: Vec<String> = text
        .split("\n\n")
        .map(str::trim)
        .filter(|p| p.len() > 40)
        .map(str::to_string)
        .collect();
    let query_terms: Vec<_> = query
        .split_whitespace()
        .filter(|t| !t.is_empty())
        .map(str::to_lowercase)
        .collect();
    let mut scored: Vec<(i32, String)> = paragraphs
        .iter()
        .map(|p| {
            let lower = p.to_lowercase();
            let score = query_terms
                .iter()
                .filter(|term| lower.contains(term.as_str()))
                .count() as i32;
            (score, p.clone())
        })
        .collect();
    scored.sort_by(|a, b| b.0.cmp(&a.0));
    let selected: Vec<String> = scored
        .iter()
        .take(max_sections)
        .map(|(_, p)| p.chars().take(500).collect())
        .collect();
    let tree = paragraphs.into_iter().take(20).collect();
    HtmlAnalysis {
        title,
        selected,
        tree,
    }
}

fn extract_title(html: &str) -> Option<String> {
    let lower = html.to_lowercase();
    let start = lower.find("<title>")? + 7;
    let end = lower[start..].find("</title>")? + start;
    Some(strip_tags(&html[start..end]).trim().to_string())
}

fn strip_tags(html: &str) -> String {
    let mut out = String::new();
    let mut in_tag = false;
    for ch in html.chars() {
        match ch {
            '<' => in_tag = true,
            '>' => in_tag = false,
            _ if !in_tag => out.push(ch),
            _ => {}
        }
    }
    out.split_whitespace().collect::<Vec<_>>().join(" ")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn extracts_title_from_html() {
        assert_eq!(
            extract_title("<html><title>Hello</title></html>").as_deref(),
            Some("Hello")
        );
    }
}
