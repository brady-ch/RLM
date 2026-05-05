import type { RecursivePromptResult, TraceEvent } from "../domain/types.js";

export interface RenderOptions {
  compact: boolean;
  json: boolean;
  includeTrace: boolean;
  model: string;
}

export function renderResult(result: RecursivePromptResult, options: RenderOptions): string {
  if (options.json) {
    return renderJson(result, options);
  }

  if (options.compact) {
    return renderCompact(result, options);
  }

  const sections = [`Answer:\n${result.answer}`];
  if (options.includeTrace) {
    sections.push(`Trace:\n${renderTrace(result.trace)}`);
  }

  return sections.join("\n\n");
}

function renderCompact(result: RecursivePromptResult, options: RenderOptions): string {
  const lines = [
    `model: ${options.model}`,
    `agent: ${result.metadata.agent.id} (${result.metadata.agent.source})`,
    `depth: ${result.metadata.depth.selected} (${result.metadata.depth.source})`,
    `answer: ${singleLine(result.answer)}`,
  ];

  if (options.includeTrace) {
    lines.push(
      "trace:",
      ...result.trace.map((event) => `- ${event.id} depth=${event.depth} ${event.kind}: ${singleLine(event.output)}`),
    );
  }

  return lines.join("\n");
}

function renderJson(result: RecursivePromptResult, options: RenderOptions): string {
  return JSON.stringify({
    answer: result.answer,
    model: options.model,
    agent: result.metadata.agent,
    depth: result.metadata.depth,
    trace: options.includeTrace ? result.trace : [],
    toolCalls: result.metadata.toolCalls,
    errors: result.metadata.errors,
  });
}

function renderTrace(events: TraceEvent[]): string {
  if (events.length === 0) {
    return "(empty)";
  }

  return events
    .map((event) => {
      const parent = event.parentId ? ` parent=${event.parentId}` : "";
      return `- ${event.id}${parent} depth=${event.depth} kind=${event.kind}\n  ${singleLine(event.output)}`;
    })
    .join("\n");
}

function singleLine(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}
