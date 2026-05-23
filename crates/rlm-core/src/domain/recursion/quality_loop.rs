use std::collections::HashMap;

use async_trait::async_trait;
use serde_json::Value;

use crate::domain::recursion::{can_spend_any_model_call, preview, remaining_model_calls};
use crate::domain::types::{
    ChatMessage, ExecutionEvent, ExecutionStatus, ExecutionStatusUpdateDetail,
    QualityLoopBestOfProgressEvaluation, QualityLoopCandidateSummary, QualityLoopConfig,
    QualityLoopCritiqueEvaluation, QualityLoopEvaluatorParseStatus, QualityLoopGateEvaluation,
    QualityLoopIssue, QualityLoopIterationRecord, QualityLoopManualDecision, QualityLoopMetadata,
    QualityLoopModelSource, QualityLoopPhaseModelAssignment, QualityLoopPhaseName,
    QualityLoopPhaseRecord, QualityLoopRubricCriterion, QualityLoopRubricId,
    QualityLoopRubricSelection, QualityLoopSelectionMetadata, QualityLoopStatus,
    QualityLoopStopReason, QualityLoopUsageSummary, RecursiveModelConfig, TaskNode,
    TokenUsageTrace,
};
use crate::ports::{LanguageModel, LanguageModelCompleteOptions};

pub const QUALITY_LOOP_PHASES: [QualityLoopPhaseName; 5] = QualityLoopPhaseName::ALL;

#[derive(Debug)]
pub struct QualityLoopManualExit {
    pub answer: String,
}

impl std::fmt::Display for QualityLoopManualExit {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "quality loop manual exit")
    }
}

impl std::error::Error for QualityLoopManualExit {}

#[async_trait]
pub trait QualityLoopHost: Send + Sync {
    fn model(&self) -> &dyn LanguageModel;
    fn get_model_calls(&self) -> u32;
    fn get_max_model_calls(&self) -> u32;
    fn consume_model_call(&self);
    fn get_tool_calls_used_count(&self) -> u32;
    fn get_token_usage(&self) -> TokenUsageTrace;
    fn get_depth_selected(&self) -> i32;
    fn throw_if_cancelled(&self, task: &TaskNode) -> Result<(), String>;
    fn is_execution_cancelled(&self) -> bool;
    fn push_metadata_error(&self, message: &str);
    fn emit_execution(&self, event: ExecutionEvent);
    fn write_loop_metadata(&self, node_id: &str, metadata: &QualityLoopMetadata);
    fn mark_execution_node_running(&self, node_id: &str);
    fn mark_execution_node_completed(&self, node_id: &str);
    fn mark_execution_node_failed(
        &self,
        node_id: &str,
        status: ExecutionStatus,
        detail: Option<ExecutionStatusUpdateDetail>,
    );
    fn set_metadata_execution_status(&self, status: ExecutionStatus);
    fn summarize_quality_loop_usage(
        &self,
        metadata: &QualityLoopMetadata,
        model_calls_total: Option<u32>,
    ) -> QualityLoopUsageSummary;
    fn with_agent_system_prompt(&self, messages: Vec<ChatMessage>) -> Vec<ChatMessage>;
    fn update_execution_node_model(&self, node_id: &str, effective_model: Option<String>);
    fn get_quality_loop_decision(&self, node_id: &str) -> Option<QualityLoopManualDecision>;
}

fn now_iso() -> String {
    time::OffsetDateTime::now_utc()
        .format(&time::format_description::well_known::Rfc3339)
        .unwrap_or_else(|_| "1970-01-01T00:00:00Z".into())
}

fn rubric_criteria(id: QualityLoopRubricId) -> Vec<QualityLoopRubricCriterion> {
    match id {
        QualityLoopRubricId::GeneralAnswerQuality => vec![
            criterion(
                "directness",
                "Directness",
                "Answers the user prompt without unnecessary detours.",
            ),
            criterion(
                "correctness",
                "Correctness",
                "Avoids unsupported claims and factual mistakes.",
            ),
            criterion(
                "completeness",
                "Completeness",
                "Covers the important parts of the request.",
            ),
        ],
        QualityLoopRubricId::CodeEngineering => vec![
            criterion(
                "behavior",
                "Behavior",
                "Implements the requested behavior without regressions.",
            ),
            criterion(
                "integration",
                "Integration",
                "Fits existing code structure, types, and tests.",
            ),
            criterion(
                "verification",
                "Verification",
                "Includes concrete checks for changed behavior.",
            ),
        ],
        QualityLoopRubricId::PlanningArchitecture => vec![
            criterion(
                "scope",
                "Scope",
                "Defines clear boundaries and dependencies.",
            ),
            criterion(
                "tradeoffs",
                "Tradeoffs",
                "Surfaces relevant alternatives and consequences.",
            ),
            criterion(
                "sequence",
                "Sequence",
                "Orders work so each step is executable and verifiable.",
            ),
        ],
        QualityLoopRubricId::UserFacingWriting => vec![
            criterion(
                "audience",
                "Audience Fit",
                "Matches the user's audience and context.",
            ),
            criterion("clarity", "Clarity", "Uses clear language and structure."),
            criterion(
                "tone",
                "Tone",
                "Maintains the requested tone and level of polish.",
            ),
        ],
        QualityLoopRubricId::StructuredArtifact => vec![
            criterion(
                "schema",
                "Schema Fit",
                "Uses the requested structure and fields.",
            ),
            criterion(
                "parseability",
                "Parseability",
                "Can be consumed by downstream tools.",
            ),
            criterion(
                "coverage",
                "Coverage",
                "Includes all required items without extra ambiguity.",
            ),
        ],
    }
}

fn criterion(id: &str, label: &str, description: &str) -> QualityLoopRubricCriterion {
    QualityLoopRubricCriterion {
        id: id.into(),
        label: label.into(),
        description: description.into(),
    }
}

fn rubric_label(id: QualityLoopRubricId) -> &'static str {
    match id {
        QualityLoopRubricId::GeneralAnswerQuality => "General Answer Quality",
        QualityLoopRubricId::CodeEngineering => "Code and Engineering",
        QualityLoopRubricId::PlanningArchitecture => "Planning and Architecture",
        QualityLoopRubricId::UserFacingWriting => "User-Facing Writing",
        QualityLoopRubricId::StructuredArtifact => "Structured Artifact",
    }
}

pub fn select_quality_loop_rubric(prompt: &str, task: &TaskNode) -> QualityLoopRubricSelection {
    let source = format!("{}\n{}\n", prompt, task.kind.as_deref().unwrap_or("")).to_lowercase();

    let candidates: [(&str, QualityLoopRubricId, &[&str]); 4] = [
        (
            "code_engineering",
            QualityLoopRubricId::CodeEngineering,
            &[
                "```",
                "src/",
                ".ts",
                ".tsx",
                ".js",
                "test",
                "bug",
                "fix",
                "refactor",
                "implement",
                "typescript",
                "node",
            ],
        ),
        (
            "planning_architecture",
            QualityLoopRubricId::PlanningArchitecture,
            &[
                "plan",
                "architecture",
                "roadmap",
                "design",
                "tradeoff",
                "system",
                "phase",
            ],
        ),
        (
            "user_facing_writing",
            QualityLoopRubricId::UserFacingWriting,
            &[
                "rewrite",
                "copy",
                "email",
                "tone",
                "blog",
                "headline",
                "announcement",
                "user documentation",
            ],
        ),
        (
            "structured_artifact",
            QualityLoopRubricId::StructuredArtifact,
            &[
                "json",
                "yaml",
                "schema",
                "table",
                "checklist",
                "frontmatter",
                "xml",
                "csv",
            ],
        ),
    ];

    let mut selected = QualityLoopRubricId::GeneralAnswerQuality;
    let mut matched_signals: Vec<String> = Vec::new();

    for (_name, id, patterns) in candidates {
        let signals: Vec<String> = patterns
            .iter()
            .filter(|p| source.contains(**p))
            .map(|p| (*p).to_string())
            .collect();
        if signals.len() > matched_signals.len() {
            selected = id;
            matched_signals = signals;
        }
    }

    let fallback =
        matches!(selected, QualityLoopRubricId::GeneralAnswerQuality) && matched_signals.is_empty();
    let rationale = if fallback {
        "Selected the general answer quality rubric because no more specific task signals were detected.".into()
    } else {
        format!(
            "Selected {} because the prompt matched {} task signal(s).",
            rubric_label(selected),
            matched_signals.len()
        )
    };
    let confidence = if fallback {
        0.4
    } else {
        (0.45 + matched_signals.len() as f64 * 0.1).min(1.0)
    };

    QualityLoopRubricSelection {
        id: selected,
        label: rubric_label(selected).into(),
        rationale,
        matched_signals,
        confidence,
        criteria: rubric_criteria(selected),
    }
}

pub fn create_empty_loop_usage() -> QualityLoopUsageSummary {
    QualityLoopUsageSummary {
        iterations_started: 0,
        iterations_completed: 0,
        phase_call_counts: Default::default(),
        model_calls_total: 0,
        input_tokens: 0,
        output_tokens: 0,
        total_tokens: 0,
        unknown_completions: 0,
    }
}

fn subtract_usage(after: &TokenUsageTrace, before: &TokenUsageTrace) -> TokenUsageTrace {
    TokenUsageTrace {
        input_tokens: after.input_tokens.saturating_sub(before.input_tokens),
        output_tokens: after.output_tokens.saturating_sub(before.output_tokens),
        total_tokens: after.total_tokens.saturating_sub(before.total_tokens),
        unknown_completions: after
            .unknown_completions
            .saturating_sub(before.unknown_completions),
    }
}

fn extract_json_object(value: &str) -> Result<Value, String> {
    let start = value
        .find('{')
        .ok_or_else(|| "expected JSON object in evaluator output".to_string())?;
    let end = value
        .rfind('}')
        .filter(|&i| i > start)
        .ok_or_else(|| "expected JSON object in evaluator output".to_string())?;
    serde_json::from_str(&value[start..=end]).map_err(|e| format!("invalid evaluator JSON: {e}"))
}

fn as_record<'a>(
    value: &'a Value,
    label: &str,
) -> Result<&'a serde_json::Map<String, Value>, String> {
    value
        .as_object()
        .ok_or_else(|| format!("{label} must be a JSON object"))
}

fn require_string(record: &serde_json::Map<String, Value>, key: &str) -> Result<String, String> {
    record
        .get(key)
        .and_then(|v| v.as_str())
        .filter(|s| !s.trim().is_empty())
        .map(str::to_string)
        .ok_or_else(|| format!("{key} must be a non-empty string"))
}

fn optional_string(value: Option<&Value>) -> Option<String> {
    value
        .and_then(|v| v.as_str())
        .filter(|s| !s.trim().is_empty())
        .map(str::to_string)
}

fn require_number(record: &serde_json::Map<String, Value>, key: &str) -> Result<f64, String> {
    record
        .get(key)
        .and_then(|v| v.as_f64())
        .filter(|n| n.is_finite())
        .ok_or_else(|| format!("{key} must be a finite number"))
}

fn require_bool(record: &serde_json::Map<String, Value>, key: &str) -> Result<bool, String> {
    record
        .get(key)
        .and_then(|v| v.as_bool())
        .ok_or_else(|| format!("{key} must be a boolean"))
}

fn parse_string_array(value: Option<&Value>, key: &str) -> Result<Vec<String>, String> {
    let arr = value
        .and_then(|v| v.as_array())
        .ok_or_else(|| format!("{key} must be a string array"))?;
    arr.iter()
        .map(|item| {
            item.as_str()
                .map(str::to_string)
                .ok_or_else(|| format!("{key} must be a string array"))
        })
        .collect()
}

fn parse_issue_array(
    value: Option<&Value>,
    source_phase: QualityLoopPhaseName,
) -> Result<Vec<QualityLoopIssue>, String> {
    let arr = value
        .and_then(|v| v.as_array())
        .ok_or_else(|| "issues must be an array".to_string())?;
    arr.iter()
        .enumerate()
        .map(|(index, item)| {
            let record = as_record(item, "issue")?;
            let severity = require_string(record, "severity")?;
            if severity != "info" && severity != "warning" && severity != "error" {
                return Err("issue severity must be info, warning, or error".into());
            }
            Ok(QualityLoopIssue {
                id: optional_string(record.get("id"))
                    .unwrap_or_else(|| format!("{}-issue-{}", source_phase.as_str(), index + 1)),
                severity,
                text: require_string(record, "text")?,
                source_phase,
            })
        })
        .collect()
}

pub fn parse_quality_loop_critique(
    value: &str,
    phase: QualityLoopPhaseName,
) -> Result<QualityLoopCritiqueEvaluation, String> {
    let parsed = extract_json_object(value)?;
    let record = as_record(&parsed, "critique evaluator output")?;
    Ok(QualityLoopCritiqueEvaluation {
        summary: require_string(record, "summary")?,
        resolved: require_bool(record, "resolved")?,
        issues: parse_issue_array(record.get("issues"), phase)?,
        suggested_improvements: parse_string_array(
            record.get("suggestedImprovements"),
            "suggestedImprovements",
        )?,
    })
}

pub fn parse_quality_loop_gate(value: &str) -> Result<QualityLoopGateEvaluation, String> {
    let parsed = extract_json_object(value)?;
    let record = as_record(&parsed, "gate evaluator output")?;
    let decision = require_string(record, "decision")?;
    if decision != "pass" && decision != "continue" {
        return Err("gate decision must be pass or continue".into());
    }
    Ok(QualityLoopGateEvaluation {
        decision,
        score: require_number(record, "score")?,
        pass_threshold: require_number(record, "passThreshold")?,
        rubric_fit: require_bool(record, "rubricFit")?,
        critique_resolved: require_bool(record, "critiqueResolved")?,
        meaningful_improvement: require_bool(record, "meaningfulImprovement")?,
        rationale: require_string(record, "rationale")?,
        failed_conditions: parse_string_array(record.get("failedConditions"), "failedConditions")?,
        unresolved_issues: parse_issue_array(
            record.get("unresolvedIssues"),
            QualityLoopPhaseName::Gate,
        )?,
    })
}

pub fn parse_quality_loop_best_of_progress(
    value: &str,
    fallback_candidate_id: &str,
) -> Result<(QualityLoopBestOfProgressEvaluation, Option<String>), String> {
    let parsed = extract_json_object(value)?;
    let record = as_record(&parsed, "best-of-progress evaluator output")?;
    let selected_candidate_id = optional_string(record.get("selectedCandidateId"))
        .unwrap_or_else(|| fallback_candidate_id.into());
    let answer_text = optional_string(record.get("answer"));
    Ok((
        QualityLoopBestOfProgressEvaluation {
            selected_candidate_id,
            rationale: require_string(record, "rationale")?,
            score: require_number(record, "score")?,
            comparison_notes: parse_string_array(record.get("comparisonNotes"), "comparisonNotes")?,
        },
        answer_text,
    ))
}

pub fn gate_passes(evaluation: &QualityLoopGateEvaluation) -> bool {
    evaluation.decision == "pass"
        && evaluation.score >= evaluation.pass_threshold
        && evaluation.rubric_fit
        && evaluation.critique_resolved
        && evaluation.meaningful_improvement
        && !evaluation
            .unresolved_issues
            .iter()
            .any(|issue| issue.severity == "error")
}

pub fn critique_resolved(evaluation: &QualityLoopGateEvaluation) -> bool {
    evaluation.score >= evaluation.pass_threshold
        && evaluation.critique_resolved
        && evaluation
            .unresolved_issues
            .iter()
            .all(|issue| issue.severity == "info")
}

pub fn has_meaningful_improvement(
    current: &QualityLoopGateEvaluation,
    previous: Option<&QualityLoopGateEvaluation>,
) -> bool {
    let Some(previous) = previous else {
        return true;
    };
    let unresolved_count = |evaluation: &QualityLoopGateEvaluation| {
        evaluation
            .unresolved_issues
            .iter()
            .filter(|issue| issue.severity == "warning" || issue.severity == "error")
            .count()
    };
    current.score - previous.score >= 0.05 || unresolved_count(current) < unresolved_count(previous)
}

fn score_quality_loop_candidate(
    candidate: &mut QualityLoopCandidateSummary,
    metadata: &QualityLoopMetadata,
    gate: Option<&QualityLoopGateEvaluation>,
) -> f64 {
    let candidate_score = candidate.score.unwrap_or_else(|| {
        if candidate.phase == QualityLoopPhaseName::BestOfProgress {
            if metadata.selection.is_some() {
                0.0
            } else {
                gate.map(|g| g.score).unwrap_or(0.0)
            }
        } else {
            0.0
        }
    });
    let iteration = metadata
        .iterations
        .iter()
        .find(|item| item.index == candidate.iteration);
    let issue_penalty = iteration
        .map(|item| {
            item.unresolved_issues
                .iter()
                .fold(0.0, |total, issue| match issue.severity.as_str() {
                    "error" => total + 0.3,
                    "warning" => total + 0.15,
                    _ => total + 0.03,
                })
        })
        .unwrap_or(0.0);
    let phase_bonus = match candidate.phase {
        QualityLoopPhaseName::Refine => 0.03,
        QualityLoopPhaseName::BestOfProgress => 0.02,
        _ => 0.0,
    };
    let recency_bonus = candidate.iteration as f64 * 0.001;
    candidate_score + phase_bonus + recency_bonus - issue_penalty
}

fn select_best_quality_loop_candidate(
    metadata: &mut QualityLoopMetadata,
    evaluation: &QualityLoopBestOfProgressEvaluation,
    gate: Option<&QualityLoopGateEvaluation>,
) -> Result<QualityLoopSelectionMetadata, String> {
    if let Some(index) = metadata
        .candidates
        .iter()
        .position(|candidate| candidate.id == evaluation.selected_candidate_id)
    {
        let mut scoring = metadata.candidates[index].clone();
        let selection_score = score_quality_loop_candidate(&mut scoring, metadata, gate);
        metadata.candidates[index].score = Some(evaluation.score);
        metadata.candidates[index].selection_score = Some(selection_score);
        let selected_id = metadata.candidates[index].id.clone();
        return Ok(QualityLoopSelectionMetadata {
            selected_candidate_id: selected_id,
            rationale: evaluation.rationale.clone(),
            score_basis: vec![
                format!("best_of_progress_score:{}", evaluation.score),
                gate.map(|g| format!("gate_score:{}", g.score))
                    .unwrap_or_else(|| "gate_score:none".into()),
                "valid_best_of_progress_selection".into(),
            ],
            comparison_notes: evaluation.comparison_notes.clone(),
            fallback_reason: None,
            invalid_candidate_id: None,
        });
    }

    let mut scored: Vec<(usize, f64)> = metadata
        .candidates
        .iter()
        .enumerate()
        .map(|(index, candidate)| {
            let mut scoring = candidate.clone();
            (
                index,
                score_quality_loop_candidate(&mut scoring, metadata, gate),
            )
        })
        .collect();
    scored.sort_by(|a, b| {
        b.1.partial_cmp(&a.1)
            .unwrap_or(std::cmp::Ordering::Equal)
            .then_with(|| {
                metadata.candidates[b.0]
                    .iteration
                    .cmp(&metadata.candidates[a.0].iteration)
            })
    });

    let Some((index, selection_score)) = scored.first().copied() else {
        return Err(format!(
            "best_of_progress selected invalid candidate id {} and no fallback candidate exists",
            evaluation.selected_candidate_id
        ));
    };
    metadata.candidates[index].selection_score = Some(selection_score);
    let fallback = metadata.candidates[index].clone();

    Ok(QualityLoopSelectionMetadata {
        selected_candidate_id: fallback.id.clone(),
        rationale: format!(
            "Selected fallback candidate {} because best_of_progress referenced an invalid candidate id.",
            fallback.id
        ),
        score_basis: vec![
            format!(
                "fallback_selection_score:{}",
                fallback.selection_score.unwrap_or(0.0)
            ),
            gate.map(|g| format!("gate_score:{}", g.score))
                .unwrap_or_else(|| "gate_score:none".into()),
            "invalid_best_of_progress_selection".into(),
        ],
        comparison_notes: evaluation.comparison_notes.clone(),
        fallback_reason: Some("invalid_best_of_progress_candidate".into()),
        invalid_candidate_id: Some(evaluation.selected_candidate_id.clone()),
    })
}

fn quality_loop_messages(
    original_prompt: &str,
    phase: QualityLoopPhaseName,
    phase_outputs: &HashMap<QualityLoopPhaseName, String>,
) -> Vec<ChatMessage> {
    let draft = phase_outputs
        .get(&QualityLoopPhaseName::Draft)
        .cloned()
        .unwrap_or_default();
    let critique = phase_outputs
        .get(&QualityLoopPhaseName::Critique)
        .cloned()
        .unwrap_or_default();
    let refine = phase_outputs
        .get(&QualityLoopPhaseName::Refine)
        .cloned()
        .unwrap_or_default();
    let gate = phase_outputs
        .get(&QualityLoopPhaseName::Gate)
        .cloned()
        .unwrap_or_default();

    let instruction = match phase {
        QualityLoopPhaseName::Draft => "Draft the best direct answer to the user prompt.",
        QualityLoopPhaseName::Critique => {
            "Return JSON only with summary, resolved, issues, and suggestedImprovements after critiquing the draft."
        }
        QualityLoopPhaseName::Refine => {
            "Refine the draft using the critique while preserving useful content."
        }
        QualityLoopPhaseName::Gate => {
            "Return JSON only with decision, score, passThreshold, rubricFit, critiqueResolved, meaningfulImprovement, rationale, failedConditions, and unresolvedIssues."
        }
        QualityLoopPhaseName::BestOfProgress => {
            "Return JSON only with selectedCandidateId, answer, rationale, score, and comparisonNotes for the best final answer."
        }
    };

    let context = [
        (!draft.is_empty()).then(|| format!("Draft:\n{draft}")),
        (!critique.is_empty()).then(|| format!("Critique:\n{critique}")),
        (!refine.is_empty()).then(|| format!("Refine:\n{refine}")),
        (!gate.is_empty()).then(|| format!("Gate:\n{gate}")),
    ]
    .into_iter()
    .flatten()
    .collect::<Vec<_>>()
    .join("\n\n");

    let user_content = if context.is_empty() {
        original_prompt.to_string()
    } else {
        format!("Original prompt:\n{original_prompt}\n\n{context}")
    };

    vec![
        ChatMessage {
            role: "system".into(),
            content: format!("{instruction} Do not call tools."),
            ..Default::default()
        },
        ChatMessage {
            role: "user".into(),
            content: user_content,
            ..Default::default()
        },
    ]
}

fn quality_loop_stop_message(stop_reason: QualityLoopStopReason) -> String {
    match stop_reason {
        QualityLoopStopReason::BudgetExhausted => "quality loop stopped: budget_exhausted".into(),
        QualityLoopStopReason::Degraded => "quality loop stopped: degraded".into(),
        QualityLoopStopReason::Failed => "quality loop stopped: failed".into(),
        other => format!(
            "quality loop stopped: {}",
            serde_json::to_string(&other)
                .unwrap_or_default()
                .trim_matches('"')
        ),
    }
}

fn quality_loop_phase_purpose(phase: QualityLoopPhaseName) -> &'static str {
    match phase {
        QualityLoopPhaseName::Draft => "quality_loop_draft",
        QualityLoopPhaseName::Critique => "quality_loop_critique",
        QualityLoopPhaseName::Refine => "quality_loop_refine",
        QualityLoopPhaseName::Gate => "quality_loop_gate",
        QualityLoopPhaseName::BestOfProgress => "quality_loop_best_of_progress",
    }
}

fn phase_override(loop_config: &QualityLoopConfig, phase: QualityLoopPhaseName) -> Option<String> {
    loop_config
        .phase_models
        .as_ref()
        .and_then(|models| models.get(phase.as_str()))
        .map(|s| s.trim())
        .filter(|s| !s.is_empty())
        .map(str::to_string)
}

fn resolve_planned_model_assignment(
    task: &TaskNode,
    phase: QualityLoopPhaseName,
    purpose: &str,
    phase_override: Option<&str>,
) -> OmitAssignment {
    if let Some(override_model) = phase_override {
        return OmitAssignment {
            phase,
            purpose: purpose.into(),
            planned_selection: override_model.into(),
            planned_model: override_model.into(),
            tier: "override".into(),
        };
    }
    if let Some(node_override) = task
        .model_override
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
    {
        return OmitAssignment {
            phase,
            purpose: purpose.into(),
            planned_selection: node_override.into(),
            planned_model: node_override.into(),
            tier: "override".into(),
        };
    }
    OmitAssignment {
        phase,
        purpose: purpose.into(),
        planned_selection: purpose.into(),
        planned_model: "resolved-at-runtime".into(),
        tier: "unknown".into(),
    }
}

struct OmitAssignment {
    phase: QualityLoopPhaseName,
    purpose: String,
    planned_selection: String,
    planned_model: String,
    tier: String,
}

struct PhaseCompletionResult {
    content: String,
    model: String,
    model_assignment: QualityLoopPhaseModelAssignment,
    usage_delta: TokenUsageTrace,
    model_calls_delta: u32,
    completed_at: String,
}

async fn complete_quality_loop_phase(
    host: &dyn QualityLoopHost,
    task: &TaskNode,
    phase: QualityLoopPhaseName,
    messages: Vec<ChatMessage>,
    loop_config: &QualityLoopConfig,
    _started_at: String,
    mut check_manual_decision: impl FnMut() -> Option<String>,
) -> Result<PhaseCompletionResult, QualityLoopManualExit> {
    host.throw_if_cancelled(task)
        .map_err(|message| QualityLoopManualExit { answer: message })?;
    if !can_spend_any_model_call(host.get_model_calls(), host.get_max_model_calls()) {
        return Err(QualityLoopManualExit {
            answer: format!(
                "model call budget reached before quality loop {}",
                phase.as_str()
            ),
        });
    }

    let usage_before = host.get_token_usage();
    let model_calls_before = host.get_model_calls();
    let purpose = quality_loop_phase_purpose(phase);
    let phase_override_value = phase_override(loop_config, phase);
    let source = if phase_override_value.is_some() {
        QualityLoopModelSource::PhaseOverride
    } else if task.model_override.is_some() {
        QualityLoopModelSource::NodeOverride
    } else {
        QualityLoopModelSource::Configured
    };
    let planned =
        resolve_planned_model_assignment(task, phase, purpose, phase_override_value.as_deref());

    host.consume_model_call();
    let response = host
        .model()
        .complete(
            &host.with_agent_system_prompt(messages),
            LanguageModelCompleteOptions::simple(Some(purpose), false),
        )
        .await;

    if let Some(outcome) = check_manual_decision() {
        return Err(QualityLoopManualExit { answer: outcome });
    }

    host.update_execution_node_model(&task.id, response.model.clone());
    let completed_at = now_iso();
    let effective_model = response
        .model
        .clone()
        .unwrap_or_else(|| planned.planned_model.clone());

    Ok(PhaseCompletionResult {
        content: response.content,
        model: response.model.unwrap_or_else(|| "unknown".into()),
        model_assignment: QualityLoopPhaseModelAssignment {
            phase: planned.phase,
            purpose: planned.purpose,
            planned_selection: planned.planned_selection,
            planned_model: planned.planned_model,
            effective_model,
            tier: planned.tier,
            source,
        },
        usage_delta: subtract_usage(&host.get_token_usage(), &usage_before),
        model_calls_delta: host.get_model_calls().saturating_sub(model_calls_before),
        completed_at,
    })
}

fn increment_phase_count(
    usage: &mut QualityLoopUsageSummary,
    phase: QualityLoopPhaseName,
    delta: u32,
) {
    match phase {
        QualityLoopPhaseName::Draft => usage.phase_call_counts.draft += delta,
        QualityLoopPhaseName::Critique => usage.phase_call_counts.critique += delta,
        QualityLoopPhaseName::Refine => usage.phase_call_counts.refine += delta,
        QualityLoopPhaseName::Gate => usage.phase_call_counts.gate += delta,
        QualityLoopPhaseName::BestOfProgress => usage.phase_call_counts.best_of_progress += delta,
    }
}

struct QualityLoopState {
    metadata: QualityLoopMetadata,
    candidate_texts: HashMap<String, String>,
    selected_candidate_id: Option<String>,
}

fn finish_quality_loop(
    host: &dyn QualityLoopHost,
    task: &TaskNode,
    state: &mut QualityLoopState,
    loop_model_calls_before: u32,
    status: QualityLoopStatus,
    stop_reason: QualityLoopStopReason,
    message: String,
) -> String {
    state.metadata.status = status;
    state.metadata.stop_reason = Some(stop_reason);
    state.metadata.message = Some(message.clone());
    state.metadata.usage = host.summarize_quality_loop_usage(
        &state.metadata,
        Some(
            host.get_model_calls()
                .saturating_sub(loop_model_calls_before),
        ),
    );
    if let Some(id) = state.selected_candidate_id.clone() {
        state.metadata.selected_candidate_id = Some(id);
    }
    host.write_loop_metadata(&task.id, &state.metadata);

    match status {
        QualityLoopStatus::Failed => {
            host.mark_execution_node_failed(
                &task.id,
                ExecutionStatus::Failed,
                Some(ExecutionStatusUpdateDetail {
                    failure_category: Some("model".into()),
                    code: Some("model".into()),
                    message: Some(message.clone()),
                }),
            );
        }
        QualityLoopStatus::Cancelled => {
            host.mark_execution_node_failed(
                &task.id,
                ExecutionStatus::Cancelled,
                Some(ExecutionStatusUpdateDetail {
                    failure_category: Some("cancelled".into()),
                    code: Some("cancelled".into()),
                    message: Some(message.clone()),
                }),
            );
        }
        _ => host.mark_execution_node_completed(&task.id),
    }

    let event_status = match status {
        QualityLoopStatus::Failed => ExecutionStatus::Failed,
        QualityLoopStatus::Cancelled => ExecutionStatus::Cancelled,
        _ => ExecutionStatus::Completed,
    };
    let mut stop_event = ExecutionEvent::execution(event_status);
    stop_event.node_id = Some(task.id.clone());
    stop_event.model_calls_used = Some(host.get_model_calls());
    stop_event.model_calls_remaining = Some(remaining_model_calls(
        host.get_model_calls(),
        host.get_max_model_calls(),
    ));
    stop_event.tool_calls_used = Some(host.get_tool_calls_used_count());
    stop_event.message = Some(quality_loop_stop_message(stop_reason));
    host.emit_execution(stop_event);

    let execution_status = match status {
        QualityLoopStatus::Failed => ExecutionStatus::Failed,
        QualityLoopStatus::Cancelled => ExecutionStatus::Cancelled,
        _ => ExecutionStatus::Completed,
    };
    host.set_metadata_execution_status(execution_status);
    state
        .selected_candidate_id
        .as_ref()
        .and_then(|id| state.candidate_texts.get(id))
        .cloned()
        .unwrap_or_default()
}

pub async fn run_quality_loop(
    host: &dyn QualityLoopHost,
    task: &TaskNode,
    config: &RecursiveModelConfig,
) -> String {
    let Some(loop_config) = config.quality_loop.as_ref().filter(|q| q.enabled) else {
        return String::new();
    };

    let metadata = QualityLoopMetadata {
        config: loop_config.clone(),
        status: QualityLoopStatus::Running,
        rubric: Some(select_quality_loop_rubric(&task.prompt, task)),
        gate: None,
        selection: None,
        phase_models: None,
        stop_reason: None,
        usage: create_empty_loop_usage(),
        iterations: Vec::new(),
        candidates: Vec::new(),
        selected_candidate_id: None,
        unresolved_issues: Vec::new(),
        message: None,
    };
    let mut state = QualityLoopState {
        metadata,
        candidate_texts: HashMap::new(),
        selected_candidate_id: None,
    };
    let loop_model_calls_before = host.get_model_calls();
    host.write_loop_metadata(&task.id, &state.metadata);
    host.mark_execution_node_running(&task.id);

    let mut event = ExecutionEvent::execution(ExecutionStatus::Running);
    event.node_id = Some(task.id.clone());
    event.model_calls_used = Some(host.get_model_calls());
    event.model_calls_remaining = Some(remaining_model_calls(
        host.get_model_calls(),
        host.get_max_model_calls(),
    ));
    event.tool_calls_used = Some(host.get_tool_calls_used_count());
    event.message = Some("quality loop started".into());
    host.emit_execution(event);

    let mut previous_gate_evaluation: Option<QualityLoopGateEvaluation> = None;

    let run_result: Result<String, String> = async {
        for iteration_index in 0..loop_config.max_iterations {
            if let Some(decision) = host.get_quality_loop_decision(&task.id) {
                if decision.action == "stop" {
                    return Ok(finish_quality_loop(
                        host,
                        task,
                        &mut state,
                        loop_model_calls_before,
                        QualityLoopStatus::Stopped,
                        QualityLoopStopReason::Stopped,
                        decision.reason,
                    ));
                }
                if state.selected_candidate_id.is_some() {
                    return Ok(finish_quality_loop(
                        host,
                        task,
                        &mut state,
                        loop_model_calls_before,
                        QualityLoopStatus::Completed,
                        QualityLoopStopReason::HumanAccepted,
                        decision.reason,
                    ));
                }
            }
            if remaining_model_calls(host.get_model_calls(), host.get_max_model_calls()) < 5 {
                return Ok(finish_quality_loop(
                    host,
                    task,
                    &mut state,
                    loop_model_calls_before,
                    QualityLoopStatus::Stopped,
                    QualityLoopStopReason::BudgetExhausted,
                    "quality loop stopped before partial iteration".into(),
                ));
            }

            host.throw_if_cancelled(task)?;
            let iteration = QualityLoopIterationRecord {
                index: iteration_index,
                status: QualityLoopStatus::Running,
                started_at: now_iso(),
                completed_at: None,
                phases: Vec::new(),
                candidates: Vec::new(),
                unresolved_issues: Vec::new(),
                critique_evaluation: None,
                gate_evaluation: None,
                best_of_progress_evaluation: None,
            };
            state.metadata.iterations.push(iteration.clone());
            state.metadata.usage.iterations_started += 1;
            host.write_loop_metadata(&task.id, &state.metadata);
            let iteration_index_in_vec = state.metadata.iterations.len() - 1;

            let mut phase_outputs: HashMap<QualityLoopPhaseName, String> = HashMap::new();
            for phase in QUALITY_LOOP_PHASES {
                let started_at = now_iso();
                let mut phase_record = QualityLoopPhaseRecord {
                    phase,
                    status: QualityLoopStatus::Running,
                    started_at: started_at.clone(),
                    completed_at: None,
                    candidate_id: None,
                    summary: None,
                    model: Some("unknown".into()),
                    planned_model: None,
                    model_purpose: None,
                    model_selection: None,
                    model_source: None,
                    usage: None,
                    unresolved_issues: None,
                    parse_status: None,
                    parse_error: None,
                };
                state.metadata.iterations[iteration_index_in_vec]
                    .phases
                    .push(phase_record.clone());
                host.write_loop_metadata(&task.id, &state.metadata);

                let messages = quality_loop_messages(&task.prompt, phase, &phase_outputs);
                let mut manual_check = || -> Option<String> {
                    if let Some(decision) = host.get_quality_loop_decision(&task.id) {
                        if decision.action == "stop" {
                            return Some(finish_quality_loop(
                                host,
                                task,
                                &mut state,
                                loop_model_calls_before,
                                QualityLoopStatus::Stopped,
                                QualityLoopStopReason::Stopped,
                                decision.reason,
                            ));
                        }
                        if state.selected_candidate_id.is_some() {
                            return Some(finish_quality_loop(
                                host,
                                task,
                                &mut state,
                                loop_model_calls_before,
                                QualityLoopStatus::Completed,
                                QualityLoopStopReason::HumanAccepted,
                                decision.reason,
                            ));
                        }
                    }
                    None
                };
                let phase_result = match complete_quality_loop_phase(
                    host,
                    task,
                    phase,
                    messages,
                    loop_config,
                    started_at,
                    &mut manual_check,
                )
                .await
                {
                    Ok(result) => result,
                    Err(QualityLoopManualExit { answer }) => return Ok(answer),
                };

                phase_outputs.insert(phase, phase_result.content.clone());
                increment_phase_count(
                    &mut state.metadata.usage,
                    phase,
                    phase_result.model_calls_delta,
                );

                phase_record.status = QualityLoopStatus::Completed;
                phase_record.completed_at = Some(phase_result.completed_at.clone());
                phase_record.summary = Some(preview(&phase_result.content, 120));
                phase_record.model = Some(phase_result.model.clone());
                phase_record.planned_model =
                    Some(phase_result.model_assignment.planned_model.clone());
                phase_record.model_purpose = Some(phase_result.model_assignment.purpose.clone());
                phase_record.model_selection =
                    Some(phase_result.model_assignment.planned_selection.clone());
                phase_record.model_source = Some(phase_result.model_assignment.source);
                phase_record.usage = Some(phase_result.usage_delta);

                let assignment = phase_result.model_assignment.clone();
                state
                    .metadata
                    .phase_models
                    .get_or_insert_with(HashMap::new)
                    .insert(phase.as_str().to_string(), assignment);

                if matches!(
                    phase,
                    QualityLoopPhaseName::Draft
                        | QualityLoopPhaseName::Refine
                        | QualityLoopPhaseName::BestOfProgress
                ) {
                    let candidate = QualityLoopCandidateSummary {
                        id: format!("loop-{}-i{iteration_index}-{}", task.id, phase.as_str()),
                        iteration: iteration_index,
                        phase,
                        summary: preview(&phase_result.content, 160),
                        score: None,
                        selection_score: None,
                        selection_rationale: None,
                        is_selected: None,
                    };
                    state
                        .candidate_texts
                        .insert(candidate.id.clone(), phase_result.content.clone());
                    phase_record.candidate_id = Some(candidate.id.clone());
                    state.metadata.iterations[iteration_index_in_vec]
                        .candidates
                        .push(candidate.clone());
                    state.metadata.candidates.push(candidate);
                }

                if let Err(error) = (|| -> Result<(), String> {
                    match phase {
                        QualityLoopPhaseName::Critique => {
                            let evaluation =
                                parse_quality_loop_critique(&phase_result.content, phase)?;
                            state.metadata.iterations[iteration_index_in_vec].critique_evaluation =
                                Some(evaluation);
                            phase_record.parse_status =
                                Some(QualityLoopEvaluatorParseStatus::Parsed);
                        }
                        QualityLoopPhaseName::Gate => {
                            let evaluation = parse_quality_loop_gate(&phase_result.content)?;
                            state.metadata.iterations[iteration_index_in_vec].gate_evaluation =
                                Some(evaluation.clone());
                            state.metadata.gate = Some(evaluation);
                            phase_record.parse_status =
                                Some(QualityLoopEvaluatorParseStatus::Parsed);
                        }
                        QualityLoopPhaseName::BestOfProgress => {
                            let candidate_id = phase_record
                                .candidate_id
                                .clone()
                                .or(state.selected_candidate_id.clone())
                                .unwrap_or_else(|| {
                                    format!(
                                        "loop-{}-i{iteration_index}-{}",
                                        task.id,
                                        phase.as_str()
                                    )
                                });
                            state.selected_candidate_id = Some(candidate_id.clone());
                            let (evaluation, answer_text) = parse_quality_loop_best_of_progress(
                                &phase_result.content,
                                &candidate_id,
                            )?;
                            state.metadata.iterations[iteration_index_in_vec]
                                .best_of_progress_evaluation = Some(evaluation.clone());
                            phase_record.parse_status =
                                Some(QualityLoopEvaluatorParseStatus::Parsed);
                            if let Some(answer) = answer_text {
                                state
                                    .candidate_texts
                                    .insert(candidate_id.clone(), answer.clone());
                                if let Some(candidate) = state.metadata.iterations
                                    [iteration_index_in_vec]
                                    .candidates
                                    .iter_mut()
                                    .find(|item| item.id == candidate_id)
                                {
                                    candidate.summary = preview(&answer, 160);
                                }
                            }
                            let gate_evaluation = state.metadata.iterations[iteration_index_in_vec]
                                .gate_evaluation
                                .clone();
                            let selection = select_best_quality_loop_candidate(
                                &mut state.metadata,
                                &evaluation,
                                gate_evaluation.as_ref(),
                            )?;
                            state.selected_candidate_id =
                                Some(selection.selected_candidate_id.clone());
                            state.metadata.selection = Some(selection.clone());
                            for candidate in &mut state.metadata.candidates {
                                candidate.is_selected =
                                    Some(candidate.id == selection.selected_candidate_id);
                                if candidate.is_selected == Some(true) {
                                    candidate.selection_rationale =
                                        Some(selection.rationale.clone());
                                }
                            }
                            if selection.invalid_candidate_id.is_some() {
                                return Err("invalid_best_of_progress_candidate".into());
                            }
                        }
                        _ => {}
                    }
                    Ok(())
                })() {
                    if error == "invalid_best_of_progress_candidate" {
                        return Ok(finish_quality_loop(
                            host,
                            task,
                            &mut state,
                            loop_model_calls_before,
                            QualityLoopStatus::Degraded,
                            QualityLoopStopReason::Degraded,
                            "quality loop best-of-progress selected an invalid candidate".into(),
                        ));
                    }
                    let phase_index = state.metadata.iterations[iteration_index_in_vec]
                        .phases
                        .len()
                        .saturating_sub(1);
                    let iteration = &mut state.metadata.iterations[iteration_index_in_vec];
                    let phase_record_mut = &mut iteration.phases[phase_index];
                    let issue = QualityLoopIssue {
                        id: format!(
                            "loop-{}-i{}-{}-parse-failed",
                            task.id,
                            iteration.index,
                            phase.as_str()
                        ),
                        severity: "error".into(),
                        text: error.clone(),
                        source_phase: phase,
                    };
                    phase_record_mut.parse_status =
                        Some(if state.selected_candidate_id.is_some() {
                            QualityLoopEvaluatorParseStatus::Degraded
                        } else {
                            QualityLoopEvaluatorParseStatus::Failed
                        });
                    phase_record_mut.parse_error = Some(error.clone());
                    phase_record_mut.unresolved_issues = Some(vec![issue.clone()]);
                    iteration.unresolved_issues.push(issue.clone());
                    state.metadata.unresolved_issues.push(issue);
                    iteration.status = if state.selected_candidate_id.is_some() {
                        QualityLoopStatus::Degraded
                    } else {
                        QualityLoopStatus::Failed
                    };
                    iteration.completed_at = Some(now_iso());
                    if state.selected_candidate_id.is_some() {
                        state.metadata.usage.iterations_completed += 1;
                    }
                    host.write_loop_metadata(&task.id, &state.metadata);
                    let degraded = state.selected_candidate_id.is_some();
                    return Ok(finish_quality_loop(
                        host,
                        task,
                        &mut state,
                        loop_model_calls_before,
                        if degraded {
                            QualityLoopStatus::Degraded
                        } else {
                            QualityLoopStatus::Failed
                        },
                        if degraded {
                            QualityLoopStopReason::Degraded
                        } else {
                            QualityLoopStopReason::Failed
                        },
                        if degraded {
                            format!("quality loop evaluator parse degraded: {error}")
                        } else {
                            format!("quality loop evaluator parse failed: {error}")
                        },
                    ));
                }

                if let Some(last) = state.metadata.iterations[iteration_index_in_vec]
                    .phases
                    .last_mut()
                {
                    *last = phase_record;
                }

                state.metadata.usage = host.summarize_quality_loop_usage(
                    &state.metadata,
                    Some(
                        host.get_model_calls()
                            .saturating_sub(loop_model_calls_before),
                    ),
                );
                host.write_loop_metadata(&task.id, &state.metadata);

                let mut phase_event = ExecutionEvent::execution(ExecutionStatus::Running);
                phase_event.node_id = Some(task.id.clone());
                phase_event.model_calls_used = Some(host.get_model_calls());
                phase_event.model_calls_remaining = Some(remaining_model_calls(
                    host.get_model_calls(),
                    host.get_max_model_calls(),
                ));
                phase_event.tool_calls_used = Some(host.get_tool_calls_used_count());
                phase_event.message =
                    Some(format!("quality loop phase completed: {}", phase.as_str()));
                host.emit_execution(phase_event);

                if let Some(decision) = host.get_quality_loop_decision(&task.id) {
                    if decision.action == "stop" {
                        return Ok(finish_quality_loop(
                            host,
                            task,
                            &mut state,
                            loop_model_calls_before,
                            QualityLoopStatus::Stopped,
                            QualityLoopStopReason::Stopped,
                            decision.reason,
                        ));
                    }
                    if state.selected_candidate_id.is_some() {
                        return Ok(finish_quality_loop(
                            host,
                            task,
                            &mut state,
                            loop_model_calls_before,
                            QualityLoopStatus::Completed,
                            QualityLoopStopReason::HumanAccepted,
                            decision.reason,
                        ));
                    }
                }
            }

            state.metadata.iterations[iteration_index_in_vec].status = QualityLoopStatus::Completed;
            state.metadata.iterations[iteration_index_in_vec].completed_at = Some(now_iso());
            state.metadata.usage.iterations_completed += 1;
            host.write_loop_metadata(&task.id, &state.metadata);

            if let Some(gate_evaluation) = state.metadata.iterations[iteration_index_in_vec]
                .gate_evaluation
                .clone()
            {
                if gate_passes(&gate_evaluation) {
                    return Ok(finish_quality_loop(
                        host,
                        task,
                        &mut state,
                        loop_model_calls_before,
                        QualityLoopStatus::Completed,
                        QualityLoopStopReason::Passed,
                        "quality loop passed gate".into(),
                    ));
                }
                if critique_resolved(&gate_evaluation) {
                    return Ok(finish_quality_loop(
                        host,
                        task,
                        &mut state,
                        loop_model_calls_before,
                        QualityLoopStatus::Completed,
                        QualityLoopStopReason::CritiqueResolved,
                        "quality loop critique resolved".into(),
                    ));
                }
                if !has_meaningful_improvement(&gate_evaluation, previous_gate_evaluation.as_ref())
                {
                    return Ok(finish_quality_loop(
                        host,
                        task,
                        &mut state,
                        loop_model_calls_before,
                        QualityLoopStatus::Completed,
                        QualityLoopStopReason::NoMeaningfulImprovement,
                        "quality loop stopped with no meaningful improvement".into(),
                    ));
                }
                previous_gate_evaluation = Some(gate_evaluation);
            }
        }

        Ok(finish_quality_loop(
            host,
            task,
            &mut state,
            loop_model_calls_before,
            QualityLoopStatus::Completed,
            QualityLoopStopReason::MaxIterations,
            "quality loop reached max iterations".into(),
        ))
    }
    .await;

    match run_result {
        Ok(answer) => answer,
        Err(message) => {
            if host.is_execution_cancelled() {
                finish_quality_loop(
                    host,
                    task,
                    &mut state,
                    loop_model_calls_before,
                    QualityLoopStatus::Cancelled,
                    QualityLoopStopReason::Stopped,
                    message,
                )
            } else {
                host.push_metadata_error(&message);
                finish_quality_loop(
                    host,
                    task,
                    &mut state,
                    loop_model_calls_before,
                    QualityLoopStatus::Failed,
                    QualityLoopStopReason::Failed,
                    message,
                )
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn selects_code_engineering_rubric() {
        let task = TaskNode {
            id: "t1".into(),
            parent_id: None,
            prompt: "Fix the failing TypeScript test in src/domain/types.ts.".into(),
            depth: 0,
            kind: None,
            model_override: None,
        };
        let rubric = select_quality_loop_rubric(&task.prompt, &task);
        assert!(matches!(rubric.id, QualityLoopRubricId::CodeEngineering));
    }

    #[test]
    fn gate_passes_requires_all_conditions() {
        let gate = QualityLoopGateEvaluation {
            decision: "pass".into(),
            score: 0.92,
            pass_threshold: 0.8,
            rubric_fit: true,
            critique_resolved: true,
            meaningful_improvement: true,
            rationale: "ok".into(),
            failed_conditions: vec![],
            unresolved_issues: vec![],
        };
        assert!(gate_passes(&gate));
    }

    #[test]
    fn parses_structured_evaluators() {
        let critique = parse_quality_loop_critique(
            &serde_json::json!({
                "summary": "notes",
                "resolved": false,
                "issues": [],
                "suggestedImprovements": ["clarify"]
            })
            .to_string(),
            QualityLoopPhaseName::Critique,
        )
        .expect("critique");
        assert_eq!(critique.summary, "notes");

        let gate = parse_quality_loop_gate(
            &serde_json::json!({
                "decision": "pass",
                "score": 0.9,
                "passThreshold": 0.8,
                "rubricFit": true,
                "critiqueResolved": true,
                "meaningfulImprovement": true,
                "rationale": "ok",
                "failedConditions": [],
                "unresolvedIssues": []
            })
            .to_string(),
        )
        .expect("gate");
        assert_eq!(gate.decision, "pass");
    }
}
