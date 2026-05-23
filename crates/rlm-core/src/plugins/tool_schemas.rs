use serde_json::{json, Value};

pub fn shell_schema() -> Value {
    json!({
        "type": "object",
        "properties": {
            "command": {
                "type": "string",
                "description": "A read-only shell command to run in the workspace."
            }
        },
        "required": ["command"]
    })
}

pub fn write_file_schema() -> Value {
    json!({
        "type": "object",
        "properties": {
            "path": {
                "type": "string",
                "description": "Relative file path to write inside the open workspace directory."
            },
            "content": {
                "type": "string",
                "description": "The complete file content to write, or content to append when mode is append."
            },
            "mode": {
                "type": "string",
                "enum": ["overwrite", "append"],
                "description": "Write mode. Defaults to overwrite."
            }
        },
        "required": ["path", "content"]
    })
}

pub fn web_search_schema() -> Value {
    json!({
        "type": "object",
        "properties": {
            "rawQuery": {
                "type": "string",
                "description": "Optional free-form query text combined with structured fields."
            },
            "terms": {
                "type": "array",
                "items": { "type": "string" },
                "description": "General search terms."
            },
            "exactPhrases": {
                "type": "array",
                "items": { "type": "string" },
                "description": "Phrases to wrap in quotes."
            },
            "requiredTerms": {
                "type": "array",
                "items": { "type": "string" },
                "description": "Terms to require with +term syntax."
            },
            "excludedTerms": {
                "type": "array",
                "items": { "type": "string" },
                "description": "Terms to exclude with -term syntax."
            },
            "siteFilters": {
                "type": "array",
                "items": { "type": "string" },
                "description": "Domains to restrict with site:domain."
            },
            "fileType": {
                "type": "string",
                "description": "File type to restrict with filetype:, such as pdf."
            },
            "after": {
                "type": "string",
                "description": "Lower date bound as YYYY-MM-DD, emitted as after:YYYY-MM-DD."
            },
            "before": {
                "type": "string",
                "description": "Upper date bound as YYYY-MM-DD, emitted as before:YYYY-MM-DD."
            },
            "num": {
                "type": "integer",
                "minimum": 1,
                "maximum": 10,
                "description": "Number of results to return. Defaults to 5."
            }
        }
    })
}

pub fn web_fetch_schema() -> Value {
    json!({
        "type": "object",
        "properties": {
            "url": {
                "type": "string",
                "description": "HTTP or HTTPS URL to fetch and analyze."
            },
            "query": {
                "type": "string",
                "description": "Research question or keyword query used to score page sections."
            },
            "maxSections": {
                "type": "integer",
                "minimum": 1,
                "maximum": 10,
                "description": "Maximum selected content sections to return. Defaults to 5."
            }
        },
        "required": ["url"]
    })
}

pub fn skill_schema() -> Value {
    json!({
        "type": "object",
        "properties": {
            "name": {
                "type": "string",
                "description": "Skill name to load."
            }
        },
        "required": ["name"]
    })
}
