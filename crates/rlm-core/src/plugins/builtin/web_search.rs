use std::time::Duration;

use async_trait::async_trait;
use reqwest::Client;

use crate::plugins::tool_schemas;
use crate::ports::Tool;
use crate::ports::ToolExecutionResult;

const DDG_LITE_SEARCH: &str = "https://lite.duckduckgo.com/lite/";
const ACCESS_BLOCKED_MARKER: &str = "anomaly-modal__title";

pub struct WebSearchTool {
    client: Client,
    default_num: usize,
}

impl WebSearchTool {
    pub fn new() -> Self {
        Self {
            client: Client::builder()
                .timeout(Duration::from_secs(15))
                .user_agent("Mozilla/5.0 (compatible; RLM-web-search/1.0)")
                .build()
                .unwrap_or_else(|_| Client::new()),
            default_num: 5,
        }
    }
}

impl Default for WebSearchTool {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl Tool for WebSearchTool {
    fn name(&self) -> &str {
        "web_search"
    }

    fn description(&self) -> &str {
        "Search the web using DuckDuckGo Lite and return ranked result snippets."
    }

    fn schema(&self) -> serde_json::Value {
        tool_schemas::web_search_schema()
    }

    async fn execute(&self, arguments: serde_json::Value) -> ToolExecutionResult {
        let query = build_search_query(&arguments);
        if query.is_empty() {
            return ToolExecutionResult {
                content: "Missing search query. Provide rawQuery, terms, exactPhrases, or filters."
                    .into(),
                is_error: true,
            };
        }
        let num = arguments
            .get("num")
            .and_then(|v| v.as_u64())
            .map(|n| n as usize)
            .unwrap_or(self.default_num)
            .min(10);

        let url = format!("{DDG_LITE_SEARCH}?q={}", urlencoding_encode(&query));
        let response = match self.client.get(&url).send().await {
            Ok(resp) => resp,
            Err(err) => {
                return ToolExecutionResult {
                    content: format!("web_search request failed: {err}"),
                    is_error: true,
                }
            }
        };
        let html = match response.text().await {
            Ok(text) => text,
            Err(err) => {
                return ToolExecutionResult {
                    content: err.to_string(),
                    is_error: true,
                }
            }
        };
        if html.contains(ACCESS_BLOCKED_MARKER) {
            return ToolExecutionResult {
                content: "web_search received an interactive challenge page from the provider (automated access blocked). Retry from a normal browser session or network, or try again later.".into(),
                is_error: true,
            };
        }
        let results = parse_uddg_lines(&html)
            .into_iter()
            .take(num)
            .enumerate()
            .map(|(index, row)| {
                serde_json::json!({
                    "position": index + 1,
                    "title": row.title,
                    "link": row.link,
                    "snippet": row.snippet,
                })
            })
            .collect::<Vec<_>>();
        ToolExecutionResult {
            content: serde_json::json!({ "query": query, "results": results }).to_string(),
            is_error: false,
        }
    }
}

struct UddgRow {
    title: String,
    link: String,
    snippet: String,
}

fn build_search_query(args: &serde_json::Value) -> String {
    let mut parts = Vec::new();
    if let Some(raw) = args.get("rawQuery").and_then(|v| v.as_str()) {
        parts.push(raw.trim().to_string());
    }
    if let Some(terms) = args.get("terms").and_then(|v| v.as_array()) {
        for term in terms.iter().filter_map(|v| v.as_str()) {
            parts.push(term.trim().to_string());
        }
    }
    if let Some(phrases) = args.get("exactPhrases").and_then(|v| v.as_array()) {
        for phrase in phrases.iter().filter_map(|v| v.as_str()) {
            parts.push(format!("\"{}\"", phrase.trim()));
        }
    }
    if let Some(required) = args.get("requiredTerms").and_then(|v| v.as_array()) {
        for term in required.iter().filter_map(|v| v.as_str()) {
            parts.push(format!("+{}", term.trim()));
        }
    }
    if let Some(excluded) = args.get("excludedTerms").and_then(|v| v.as_array()) {
        for term in excluded.iter().filter_map(|v| v.as_str()) {
            parts.push(format!("-{}", term.trim()));
        }
    }
    parts
        .into_iter()
        .filter(|p| !p.is_empty())
        .collect::<Vec<_>>()
        .join(" ")
}

fn urlencoding_encode(input: &str) -> String {
    input
        .bytes()
        .map(|b| match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                (b as char).to_string()
            }
            b' ' => "+".to_string(),
            _ => format!("%{b:02X}"),
        })
        .collect()
}

fn parse_uddg_lines(html: &str) -> Vec<UddgRow> {
    let mut out = Vec::new();
    let mut seen = std::collections::HashSet::new();
    for line in html.lines() {
        if !line.contains("uddg=") {
            continue;
        }
        let Some(encoded) = line
            .split("uddg=")
            .nth(1)
            .and_then(|rest| rest.split('&').next())
        else {
            continue;
        };
        let decoded = urlencoding_decode(encoded.replace("&amp;", "&").as_str());
        if !decoded.starts_with("http://") && !decoded.starts_with("https://") {
            continue;
        }
        if !seen.insert(decoded.clone()) {
            continue;
        }
        let title = extract_between(line, '>', '<').unwrap_or_else(|| decoded.clone());
        out.push(UddgRow {
            title,
            link: decoded,
            snippet: String::new(),
        });
    }
    out
}

fn extract_between(input: &str, start: char, end: char) -> Option<String> {
    let after = input.split(start).nth(1)?;
    let before = after.split(end).next()?;
    Some(before.trim().to_string())
}

fn urlencoding_decode(input: &str) -> String {
    let mut out = String::new();
    let bytes = input.as_bytes();
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%' && i + 2 < bytes.len() {
            if let Ok(value) = u8::from_str_radix(&input[i + 1..i + 3], 16) {
                out.push(value as char);
                i += 3;
                continue;
            }
        }
        if bytes[i] == b'+' {
            out.push(' ');
            i += 1;
            continue;
        }
        out.push(bytes[i] as char);
        i += 1;
    }
    out
}

#[cfg(test)]
#[path = "../../../tests/plugins/builtin/web_search.rs"]
mod web_search_tests;
