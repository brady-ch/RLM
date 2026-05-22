use serde_json::Value;

pub(crate) fn default_project_plain() -> Value {
    include_str!("../../../../../tests/fixtures/persistence/default-project-config.json")
        .parse()
        .expect("default project config fixture")
}
