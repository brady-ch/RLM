export function truncateFailureMessage(message: string, maxLength = 120): string {
  const trimmed = message.trim();
  if (trimmed.length <= maxLength) {
    return trimmed;
  }
  return `${trimmed.slice(0, maxLength - 1)}…`;
}

export async function runAction(
  setErrorMessage: (message: string | undefined) => void,
  operation: () => Promise<void>,
  refresh: () => Promise<void> = async () => undefined,
) {
  try {
    setErrorMessage(undefined);
    await operation();
    await refresh();
  } catch (error) {
    setErrorMessage(error instanceof Error ? error.message : String(error));
    await refresh();
  }
}

export function formatPlanningError(message: string): string {
  if (message.includes("planning_failed")) {
    return `Planning failed: ${message}. Check the planner model tier and prompt, then try Plan children again.`;
  }
  if (message.includes("invalid_planner_output")) {
    return `Planner returned invalid output. ${message}. No fallback was applied. Fix configuration or retry.`;
  }
  if (message.includes("invalid_prompt")) {
    return `Planning failed: ${message}. Enter a non-empty prompt before planning.`;
  }
  return message;
}

export async function post(path: string, body: Record<string, unknown>) {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const text = await response.text();
    let payload: Record<string, unknown> = {};
    if (text) {
      try {
        payload = JSON.parse(text) as Record<string, unknown>;
      } catch {
        throw new Error(text || response.statusText);
      }
    }
    const parts = [
      payload["code"],
      payload["error"] ?? payload["message"],
      payload["details"],
      payload["suggestedFix"],
    ].filter(Boolean);
    throw new Error(parts.length > 0 ? parts.join(" | ") : text || response.statusText);
  }
}

export async function postJson(path: string, body: Record<string, unknown>) {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  const payload = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  if (!response.ok) {
    const parts = [
      payload["code"],
      payload["error"] ?? payload["message"],
      payload["details"],
      payload["suggestedFix"],
    ].filter(Boolean);
    throw new Error(parts.length > 0 ? parts.join(" | ") : text || response.statusText);
  }
  return payload;
}

export async function del(path: string) {
  const response = await fetch(path, { method: "DELETE" });
  if (!response.ok) {
    throw new Error(await response.text());
  }
}

export function approvalModeLabel(
  mode: "full" | "initial-plan" | "initial-plan-recursive",
): string {
  if (mode === "initial-plan") {
    return "Initial plan";
  }
  if (mode === "initial-plan-recursive") {
    return "Initial plan + recursive";
  }
  return "Full checkpoints";
}

export function phaseLabel(phase: import("./types.js").QualityLoopPhaseName): string {
  return phase.replaceAll("_", " ");
}

export function scoreFromSelection(scoreBasis: string[] | undefined): string | undefined {
  const score = scoreBasis
    ?.find((item) => item.startsWith("best_of_progress_score:"))
    ?.split(":")[1];
  return score && score.trim().length > 0 ? score : undefined;
}

export function formatPreferenceValue(value: unknown): string {
  if (!value || typeof value !== "object") {
    return String(value ?? "");
  }
  const record = value as Record<string, unknown>;
  return String(record["value"] ?? JSON.stringify(record));
}

export function deleteStrategyLabel(strategy: "delete_subtree" | "rewire_dependents"): string {
  if (strategy === "rewire_dependents") {
    return "Rewire dependents";
  }
  return "Delete subtree";
}
