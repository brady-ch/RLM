import type { LanguageModelPort, LanguageModelPurpose } from "../../ports/language-model-port.js";
import type { TracePort } from "../../ports/trace-port.js";
import type { RecursiveModelConfig, TaskNode } from "../types.js";

export function preview(value: string, maxLength = 180): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length <= maxLength ? normalized : `${normalized.slice(0, maxLength - 3)}...`;
}

export function parseClarificationRequest(value: string): string | undefined {
  const match = value.trim().match(/^CLARIFY\s*:\s*(.+)$/is);
  return match?.[1]?.trim();
}

export function parseFirstInteger(value: string): number | undefined {
  const match = value.match(/\b\d+\b/);
  if (!match?.[0]) {
    return undefined;
  }

  return Number.parseInt(match[0], 10);
}

export function isCodeTask(task: TaskNode): boolean {
  if (task.kind === "code") {
    return true;
  }
  const normalized = task.prompt.trim().toLowerCase();
  return normalized.startsWith("code:") || normalized.startsWith("run code:");
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function fallbackFromMessages(
  messages: Parameters<LanguageModelPort["complete"]>[0],
): string {
  const userContent = [...messages].reverse().find((message) => message.role === "user")?.content;
  return userContent?.trim() || "No additional model calls are available.";
}

export function toModelPurpose(
  kind: Parameters<TracePort["record"]>[0]["kind"],
): LanguageModelPurpose | undefined {
  if (
    kind === "depth" ||
    kind === "classify" ||
    kind === "decompose" ||
    kind === "answer" ||
    kind === "summarize" ||
    kind === "synthesize"
  ) {
    return kind;
  }

  return undefined;
}

export function limitPrompt(prompt: string, config: RecursiveModelConfig): string {
  if (prompt.length <= config.maxPromptCharacters) {
    return prompt;
  }

  return prompt.slice(0, config.maxPromptCharacters).trimEnd();
}
