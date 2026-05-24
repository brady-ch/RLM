use serde_json::{Map, Value};

pub(crate) fn is_plain_record(value: &Value) -> bool {
    value.is_object()
}

pub fn merge_yaml_layers(left: Value, right: Value) -> Value {
    let mut left_map = match left {
        Value::Object(map) => map,
        _ => Map::new(),
    };
    let Value::Object(right_map) = right else {
        return right;
    };

    for (key, incoming) in right_map {
        if !incoming.is_object() {
            left_map.insert(key, incoming);
            continue;
        }

        let existing = left_map.get(&key).cloned();
        match key.as_str() {
            "agents" => {
                let mut merged = existing
                    .and_then(|value| value.as_object().cloned())
                    .unwrap_or_default();
                merged.extend(incoming.as_object().cloned().unwrap_or_default());
                left_map.insert(key, Value::Object(merged));
            }
            "models" => {
                let prior = existing
                    .and_then(|value| value.as_object().cloned())
                    .unwrap_or_default();
                let incoming_models = incoming.as_object().cloned().unwrap_or_default();
                let left_tiers = prior
                    .get("tiers")
                    .and_then(Value::as_object)
                    .cloned()
                    .unwrap_or_default();
                let right_tiers = incoming_models
                    .get("tiers")
                    .and_then(Value::as_object)
                    .cloned()
                    .unwrap_or_default();
                let left_sampling = prior
                    .get("sampling")
                    .and_then(Value::as_object)
                    .cloned()
                    .unwrap_or_default();
                let right_sampling = incoming_models
                    .get("sampling")
                    .and_then(Value::as_object)
                    .cloned()
                    .unwrap_or_default();
                let left_profiles = left_sampling
                    .get("modelProfiles")
                    .and_then(Value::as_object)
                    .cloned()
                    .unwrap_or_default();
                let right_profiles = right_sampling
                    .get("modelProfiles")
                    .and_then(Value::as_object)
                    .cloned()
                    .unwrap_or_default();
                let mut incoming_without = incoming_models.clone();
                incoming_without.remove("tiers");
                incoming_without.remove("sampling");
                let mut merged_models = prior;
                merged_models.extend(incoming_without);
                let mut merged_sampling = left_sampling.clone();
                merged_sampling.extend(right_sampling);
                let mut profiles = left_profiles;
                profiles.extend(right_profiles);
                merged_sampling.insert("modelProfiles".into(), Value::Object(profiles));
                merged_models.insert(
                    "tiers".into(),
                    Value::Object(left_tiers.into_iter().chain(right_tiers).collect()),
                );
                merged_models.insert("sampling".into(), Value::Object(merged_sampling));
                left_map.insert(key, Value::Object(merged_models));
            }
            "memory" | "runtime" => {
                let mut prior = existing
                    .and_then(|value| value.as_object().cloned())
                    .unwrap_or_default();
                prior.extend(incoming.as_object().cloned().unwrap_or_default());
                left_map.insert(key, Value::Object(prior));
            }
            "workflows" | "hosts" => {
                let mut prior = existing
                    .and_then(|value| value.as_object().cloned())
                    .unwrap_or_default();
                prior.extend(incoming.as_object().cloned().unwrap_or_default());
                left_map.insert(key, Value::Object(prior));
            }
            "interop" => {
                left_map.insert(
                    key,
                    merge_interop(existing.unwrap_or(Value::Null), incoming),
                );
            }
            _ => {
                left_map.insert(key, incoming);
            }
        }
    }

    Value::Object(left_map)
}

fn merge_interop(left: Value, right: Value) -> Value {
    let left_map = left.as_object().cloned().unwrap_or_default();
    let right_map = right.as_object().cloned().unwrap_or_default();
    let lmcp = left_map
        .get("mcp")
        .and_then(Value::as_object)
        .cloned()
        .unwrap_or_default();
    let rmcp = right_map
        .get("mcp")
        .and_then(Value::as_object)
        .cloned()
        .unwrap_or_default();
    let lskills = left_map
        .get("skills")
        .and_then(Value::as_object)
        .cloned()
        .unwrap_or_default();
    let rskills = right_map
        .get("skills")
        .and_then(Value::as_object)
        .cloned()
        .unwrap_or_default();
    let mut merged = left_map;
    merged.extend(right_map);
    merged.insert(
        "mcp".into(),
        Value::Object(lmcp.into_iter().chain(rmcp).collect()),
    );
    merged.insert(
        "skills".into(),
        Value::Object(lskills.into_iter().chain(rskills).collect()),
    );
    Value::Object(merged)
}
