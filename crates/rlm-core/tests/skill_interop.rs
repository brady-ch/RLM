use rlm_core::application::execution::{
    InMemoryRuntimeEventStore, RuntimeEventSeverity, RuntimeEventSink,
};
use rlm_core::interop::{
    discover_skill_candidates, SkillInteropConfig, SkillPathPolicy, SkillPathStrictness,
    SkillRuntime,
};
use rlm_core::persistence::LoadedProjectConfig;
use rlm_core::plugins::{build_runtime_context, BuildRuntimeContextInput, PluginRegistryService};
use serde_json::json;
use std::fs;
use std::path::PathBuf;
use std::sync::Arc;

#[test]
fn skill_parse_error_emits_lifecycle_event_lenient() {
    let store = Arc::new(InMemoryRuntimeEventStore::new());
    let runtime = SkillRuntime::with_event_sink(
        SkillInteropConfig {
            search_paths: vec![PathBuf::from("/a"), PathBuf::from("/b")],
            cache: false,
            path_policies: vec![SkillPathPolicy {
                path: PathBuf::from("/a"),
                strictness: SkillPathStrictness::Lenient,
            }],
        },
        Arc::clone(&store) as Arc<dyn RuntimeEventSink>,
        "run-1",
    );

    let resolved = runtime
        .resolve_skill(
            "narrate",
            &[
                rlm_core::interop::SkillCandidate {
                    name: "narrate".into(),
                    absolute_path: PathBuf::from("/a/narrate/SKILL.md"),
                    valid: false,
                    reason: Some("bad format".into()),
                },
                rlm_core::interop::SkillCandidate {
                    name: "narrate".into(),
                    absolute_path: PathBuf::from("/b/narrate/SKILL.md"),
                    valid: true,
                    reason: None,
                },
            ],
        )
        .expect("resolve")
        .expect("found");

    assert_eq!(
        resolved.candidate.absolute_path,
        PathBuf::from("/b/narrate/SKILL.md")
    );

    let events = store.events.lock().expect("lock");
    assert_eq!(events.len(), 1);
    assert_eq!(events[0].code, "SKILL_PARSE_ERROR");
    assert_eq!(events[0].severity, RuntimeEventSeverity::Warn);
    assert_eq!(events[0].subject, "/a/narrate/SKILL.md");
    assert_eq!(resolved.warnings[0].code, "SKILL_PARSE_ERROR");
}

#[test]
fn skill_parse_error_emits_lifecycle_event_strict() {
    let store = Arc::new(InMemoryRuntimeEventStore::new());
    let runtime = SkillRuntime::with_event_sink(
        SkillInteropConfig {
            search_paths: vec![PathBuf::from("/strict")],
            cache: false,
            path_policies: vec![SkillPathPolicy {
                path: PathBuf::from("/strict"),
                strictness: SkillPathStrictness::Strict,
            }],
        },
        Arc::clone(&store) as Arc<dyn RuntimeEventSink>,
        "run-2",
    );

    let err = runtime
        .resolve_skill(
            "parse",
            &[rlm_core::interop::SkillCandidate {
                name: "parse".into(),
                absolute_path: PathBuf::from("/strict/parse/SKILL.md"),
                valid: false,
                reason: None,
            }],
        )
        .expect_err("strict path should fail");
    assert!(err.contains("Skill parse error"));

    let events = store.events.lock().expect("lock");
    assert_eq!(events.len(), 1);
    assert_eq!(events[0].code, "SKILL_PARSE_ERROR");
    assert_eq!(events[0].severity, RuntimeEventSeverity::Error);
    assert_eq!(events[0].subject, "/strict/parse/SKILL.md");
}

#[test]
fn build_runtime_context_registers_skill_tool() {
    let temp = tempfile::tempdir().expect("tempdir");
    let ctx = build_runtime_context(BuildRuntimeContextInput {
        project_root: temp.path(),
        project_config: None,
        on_init_stage: None,
    })
    .expect("runtime");

    let names: Vec<_> = ctx
        .tools
        .iter()
        .map(|tool| tool.name().to_string())
        .collect();
    assert!(names.iter().any(|name| name == "skill"));
}

#[test]
fn skill_tool_loads_fixture_from_configured_search_path() {
    let temp = tempfile::tempdir().expect("tempdir");
    let skill_dir = temp.path().join("skills").join("summarize");
    fs::create_dir_all(&skill_dir).expect("mkdir");
    fs::write(
        skill_dir.join("SKILL.md"),
        "---\nname: summarize\ndescription: Summarize text\n---\nUse terse bullets.\n",
    )
    .expect("write");

    let config = json!({
        "interop": {
            "mcp": { "servers": [] },
            "skills": {
                "searchPaths": ["skills"],
                "duplicateStrategy": "first_match",
                "cache": false,
                "pathPolicies": [{ "path": "skills", "strictness": "strict" }]
            }
        }
    });

    let ctx = build_runtime_context(BuildRuntimeContextInput {
        project_root: temp.path(),
        project_config: Some(&config),
        on_init_stage: None,
    })
    .expect("runtime");

    let skill = ctx
        .tools
        .iter()
        .find(|tool| tool.name() == "skill")
        .expect("skill tool");

    let runtime = tokio::runtime::Runtime::new().expect("runtime");
    let result = runtime.block_on(skill.execute(json!({ "name": "summarize" })));
    assert!(!result.is_error, "{}", result.content);
    assert!(result.content.contains("Use terse bullets"));
}

#[test]
fn strict_policy_rejects_invalid_skill_candidate() {
    let temp = tempfile::tempdir().expect("tempdir");
    let skill_dir = temp.path().join("strict").join("broken");
    fs::create_dir_all(&skill_dir).expect("mkdir");
    fs::write(skill_dir.join("SKILL.md"), "No frontmatter here").expect("write");

    let search_paths = vec![temp.path().join("strict")];
    let candidates = discover_skill_candidates(&search_paths);
    let runtime = SkillRuntime::new(SkillInteropConfig {
        search_paths: search_paths.clone(),
        cache: false,
        path_policies: vec![SkillPathPolicy {
            path: temp.path().join("strict"),
            strictness: SkillPathStrictness::Strict,
        }],
    });

    let err = runtime
        .resolve_skill("broken", &candidates)
        .expect_err("strict policy should fail");
    assert!(err.contains("Skill parse error"));
}

#[test]
fn plugin_doctor_warns_on_invalid_skill_search_path() {
    let temp = tempfile::tempdir().expect("tempdir");
    let config = json!({
        "interop": {
            "skills": {
                "searchPaths": ["./missing-skills-dir"],
                "duplicateStrategy": "first_match",
                "cache": false,
                "pathPolicies": []
            }
        }
    });
    let loaded = LoadedProjectConfig {
        config,
        path: Some(temp.path().join("rlm.config.yaml")),
    };
    let service = PluginRegistryService::new(temp.path().to_path_buf(), &loaded);
    let runtime = tokio::runtime::Runtime::new().expect("runtime");
    let result = runtime
        .block_on(service.doctor(false))
        .expect("doctor should succeed");

    assert!(result
        .issues
        .iter()
        .any(|issue| { issue.code == "invalid_skill_search_path" && issue.severity == "warn" }));
}

#[test]
fn manifest_skill_loaders_register_on_extension_host() {
    let temp = tempfile::tempdir().expect("tempdir");
    let loader_root = temp.path().join("loaders").join("demo");
    fs::create_dir_all(&loader_root).expect("mkdir");

    let mut host = rlm_core::plugins::extension_host::ExtensionHost::new();
    rlm_core::plugins::extension_host::register_manifest_skill_loaders(
        &mut host,
        temp.path(),
        &["loaders/demo".to_string()],
    )
    .expect("register loaders");

    assert!(host.get_skill_loader("loaders/demo").is_some());
}
