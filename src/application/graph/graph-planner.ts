import { z } from "zod";
import type {
  ComposerComplexity,
  ComposerNodeType,
  ExpertRuntimeMode,
} from "../../domain/types.js";
import type { LanguageModelPort } from "../../ports/language-model-port.js";

const childSchema = z.object({
  label: z.string().min(1),
  prompt: z.string().min(1),
  type: z.enum(["AI", "Code", "TTS", "Splitter", "Joiner", "Validator"]),
  complexity: z.enum(["low", "medium", "high"]),
  agentId: z.enum(["default", "coding", "qa", "product_designer", "research"]).optional(),
  runtime: z.enum(["single-pass", "rlm"]).optional(),
  toolAllowlist: z.array(z.string().min(1)).optional(),
  purposeTiers: z.record(z.string(), z.string().min(1)).optional(),
});

const plannerResponseSchema = z.object({
  children: z.array(childSchema).min(1),
});

export interface PlannedChildSpec {
  label: string;
  prompt: string;
  type: ComposerNodeType;
  complexity: ComposerComplexity;
  agentId?: "default" | "coding" | "qa" | "product_designer" | "research" | undefined;
  runtime?: ExpertRuntimeMode | undefined;
  toolAllowlist?: string[] | undefined;
  purposeTiers?: Record<string, string> | undefined;
}

export interface GraphPlannerContext {
  nodeId: string;
  nodeLabel: string;
  nodePrompt: string;
  ancestors: Array<{ id: string; label: string; prompt: string }>;
  protectedDescendants?: Array<{ id: string; label: string; prompt: string }>;
  maxChildren: number;
}

export interface PlanChildrenResult {
  children: PlannedChildSpec[];
  diagnostics: { purpose: "plan"; model?: string; validationError?: string };
}

export class GraphPlannerError extends Error {
  constructor(
    public readonly code: "planning_failed" | "invalid_planner_output",
    message: string,
    public readonly details?: string,
  ) {
    super(message);
    this.name = "GraphPlannerError";
  }
}

export async function planChildren(
  model: LanguageModelPort,
  context: GraphPlannerContext,
): Promise<PlanChildrenResult> {
  let response;
  try {
    response = await model.complete(
      [
        {
          role: "system",
          content: [
            "You plan direct child nodes for an execution graph.",
            'Return ONLY JSON in this shape: {"children":[{"label":"","prompt":"","type":"AI","complexity":"medium","agentId":"coding","runtime":"single-pass"}]}.',
            `Return between 1 and ${context.maxChildren} children.`,
            "Valid type values: AI, Code, TTS, Splitter, Joiner, Validator.",
            "Valid complexity values: low, medium, high.",
            "Valid agentId values: default, coding, qa, product_designer, research.",
            "Valid runtime values: single-pass, rlm. Use rlm only for high-complexity nodes that need recursive execution.",
          ].join(" "),
        },
        {
          role: "user",
          content: [
            `Target node id: ${context.nodeId}`,
            `Target label: ${context.nodeLabel}`,
            `Target prompt: ${context.nodePrompt}`,
            "Ancestor chain:",
            context.ancestors.length === 0
              ? "(none)"
              : context.ancestors
                  .map(
                    (ancestor, index) =>
                      `${index + 1}. ${ancestor.label} (${ancestor.id}): ${ancestor.prompt}`,
                  )
                  .join("\n"),
            "Protected descendants to preserve during merge:",
            (context.protectedDescendants ?? []).length === 0
              ? "(none)"
              : (context.protectedDescendants ?? [])
                  .map(
                    (descendant, index) =>
                      `${index + 1}. ${descendant.label} (${descendant.id}): ${descendant.prompt}`,
                  )
                  .join("\n"),
          ].join("\n"),
        },
      ],
      { purpose: "plan" },
    );
  } catch (error: unknown) {
    const details = error instanceof Error ? error.message : String(error);
    throw new GraphPlannerError("planning_failed", "Graph planning failed.", details);
  }

  const jsonText = extractJsonObject(response.content);
  if (!jsonText) {
    throw new GraphPlannerError(
      "invalid_planner_output",
      "Planner returned invalid output.",
      "No JSON object found.",
    );
  }

  try {
    const parsed = plannerResponseSchema.parse(JSON.parse(jsonText));
    const diagnostics: PlanChildrenResult["diagnostics"] = { purpose: "plan" };
    if (response.model) {
      diagnostics.model = response.model;
    }
    return {
      children: parsed.children.slice(0, context.maxChildren),
      diagnostics,
    };
  } catch (error: unknown) {
    const details = error instanceof Error ? error.message : String(error);
    throw new GraphPlannerError(
      "invalid_planner_output",
      "Planner returned invalid output.",
      details,
    );
  }
}

function extractJsonObject(content: string): string | undefined {
  const start = content.indexOf("{");
  const end = content.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    return undefined;
  }
  return content.slice(start, end + 1);
}
