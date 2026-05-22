mod shell;
mod web_fetch;
mod web_search;
mod write_file;

pub use shell::GuardedShellTool;
pub use web_fetch::WebFetchTool;
pub use web_search::WebSearchTool;
pub use write_file::WorkspaceFileWriteTool;

use std::path::Path;
use std::sync::Arc;

use super::extension_host::ExtensionHost;
use super::manifest::{PluginContributes, PluginEngines, PluginManifest};

pub struct BuiltinPluginDefinition {
    pub path: &'static str,
    pub manifest: PluginManifest,
    pub register: fn(&mut ExtensionHost, &Path),
}

fn shell_manifest() -> PluginManifest {
    PluginManifest {
        id: "rlm.builtin.shell".into(),
        name: "Guarded Shell".into(),
        version: "1.0.0".into(),
        category: "shell".into(),
        contributes: PluginContributes {
            tools: vec!["shell".into()],
            skill_loaders: vec![],
            model_hosts: vec![],
        },
        engines: PluginEngines {
            rlm: ">=1.0.0".into(),
        },
    }
}

fn files_manifest() -> PluginManifest {
    PluginManifest {
        id: "rlm.builtin.files".into(),
        name: "Workspace File Write".into(),
        version: "1.0.0".into(),
        category: "files".into(),
        contributes: PluginContributes {
            tools: vec!["write_file".into()],
            skill_loaders: vec![],
            model_hosts: vec![],
        },
        engines: PluginEngines {
            rlm: ">=1.0.0".into(),
        },
    }
}

fn web_manifest() -> PluginManifest {
    PluginManifest {
        id: "rlm.builtin.web".into(),
        name: "Web Search and Fetch".into(),
        version: "1.0.0".into(),
        category: "web".into(),
        contributes: PluginContributes {
            tools: vec!["web_search".into(), "web_fetch".into()],
            skill_loaders: vec![],
            model_hosts: vec![],
        },
        engines: PluginEngines {
            rlm: ">=1.0.0".into(),
        },
    }
}

pub fn builtin_plugins() -> Vec<BuiltinPluginDefinition> {
    vec![
        BuiltinPluginDefinition {
            path: "crates/rlm-core/src/plugins/builtin/shell.rs",
            manifest: shell_manifest(),
            register: |host, root| {
                let _ = host.register_tool(Arc::new(GuardedShellTool::new(root)));
            },
        },
        BuiltinPluginDefinition {
            path: "crates/rlm-core/src/plugins/builtin/write_file.rs",
            manifest: files_manifest(),
            register: |host, root| {
                let _ = host.register_tool(Arc::new(WorkspaceFileWriteTool::new(root)));
            },
        },
        BuiltinPluginDefinition {
            path: "crates/rlm-core/src/plugins/builtin/web_search.rs",
            manifest: web_manifest(),
            register: |host, _root| {
                let _ = host.register_tool(Arc::new(WebSearchTool::new()));
                let _ = host.register_tool(Arc::new(WebFetchTool::new()));
            },
        },
    ]
}

pub fn load_builtins(host: &mut ExtensionHost, workspace_root: &Path) {
    for builtin in builtin_plugins() {
        (builtin.register)(host, workspace_root);
    }
}
