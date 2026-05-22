use std::path::PathBuf;

use rlm_core::persistence::{FileMemoryStore, FileSessionStore, ProjectPaths};
use serde_json::json;

use crate::flags::{parse_preference_assignment, CommandContext};

pub async fn handle_session_flags(
    ctx: &CommandContext,
) -> Result<bool, Box<dyn std::error::Error>> {
    let flags = &ctx.flags;
    let paths = ProjectPaths::from_root(ctx.project_root.clone());

    if flags.session_list {
        let store = FileSessionStore::new(paths.sessions_dir);
        let sessions = store.list().map_err(|err| err.to_string())?;
        println!(
            "{}",
            serde_json::to_string_pretty(&json!({ "sessions": sessions }))?
        );
        return Ok(true);
    }

    if let Some(session_id) = flags.session_inspect.as_deref() {
        let store = FileSessionStore::new(paths.sessions_dir);
        let verification = store.inspect(session_id).map_err(|err| err.to_string())?;
        println!("{}", serde_json::to_string_pretty(&verification)?);
        return Ok(true);
    }

    if let Some(run_id) = flags.memory_inspect.as_deref() {
        let store = FileMemoryStore::new(paths.memory_dir);
        let snapshot = store.inspect(run_id).map_err(|err| err.to_string())?;
        println!("{}", serde_json::to_string_pretty(&snapshot)?);
        return Ok(true);
    }

    if let Some(assignment) = flags.preference_set.as_deref() {
        let (key, value) = parse_preference_assignment(assignment)?;
        let store = FileMemoryStore::new(paths.memory_dir);
        store
            .set_preference("preferences-cli", &key, &value, "cli", "project")
            .map_err(|err| err.to_string())?;
        let snapshot = store
            .inspect("preferences-cli")
            .map_err(|err| err.to_string())?;
        println!("{}", serde_json::to_string_pretty(&snapshot)?);
        return Ok(true);
    }

    if let Some(key) = flags.preference_delete.as_deref() {
        let store = FileMemoryStore::new(paths.memory_dir);
        store
            .delete_preference("preferences-cli", key)
            .map_err(|err| err.to_string())?;
        let snapshot = store
            .inspect("preferences-cli")
            .map_err(|err| err.to_string())?;
        println!("{}", serde_json::to_string_pretty(&snapshot)?);
        return Ok(true);
    }

    let _ = flags.open_session.as_deref();
    Ok(false)
}

pub fn session_store(project_root: PathBuf) -> FileSessionStore {
    FileSessionStore::new(ProjectPaths::from_root(project_root).sessions_dir)
}
