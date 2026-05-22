import type {
  LanguageModelCompleteOptions,
  LanguageModelMessage,
  LanguageModelPort,
  LanguageModelResponse,
} from "../../src/ports/language-model-port.js";
import type { PlannedChildSpec } from "../../src/application/graph-planner.js";

export function createMockPlanModel(
  specs: PlannedChildSpec[] | "invalid" | "throw",
): LanguageModelPort {
  return {
    async complete(
      _messages: LanguageModelMessage[],
      _options: LanguageModelCompleteOptions = {},
    ): Promise<LanguageModelResponse> {
      if (specs === "throw") {
        throw new Error("planner unavailable");
      }
      if (specs === "invalid") {
        return { content: "{not json}", toolCalls: [] };
      }
      return {
        content: JSON.stringify({ children: specs }),
        toolCalls: [],
        model: "mock-planner",
      };
    },
  };
}

export const audiobookPlanChildren: PlannedChildSpec[] = [
  {
    label: "Parse book into segments",
    prompt: "Parse the source book into ordered chapter and segment artifact refs.",
    type: "Splitter",
    complexity: "medium",
  },
  {
    label: "Interpret speakers",
    prompt:
      "Infer speaker attribution and update a persistent speaker bible from bounded text segments.",
    type: "AI",
    complexity: "high",
  },
  {
    label: "Generate TTS clips",
    prompt: "Generate consistent per-speaker audio clips from segment refs and voice profiles.",
    type: "TTS",
    complexity: "high",
  },
  {
    label: "Validate continuity",
    prompt: "Validate speaker and audio continuity across generated clips.",
    type: "Validator",
    complexity: "medium",
  },
  {
    label: "Splice final audio",
    prompt: "Splice ordered audio artifact refs into the final audiobook file.",
    type: "Code",
    complexity: "medium",
  },
];

export const genericPlanChildren: PlannedChildSpec[] = [
  {
    label: "Plan implementation slice",
    prompt: "Create the smallest safe implementation slice.",
    type: "AI",
    complexity: "medium",
  },
  {
    label: "Execute code changes",
    prompt: "Apply code or configuration changes.",
    type: "Code",
    complexity: "medium",
  },
  {
    label: "Validate results",
    prompt: "Validate the completed work.",
    type: "Validator",
    complexity: "low",
  },
];

export const expertPlanChildren: PlannedChildSpec[] = [
  {
    label: "Implement feature",
    prompt: "Implement the feature.",
    type: "Code",
    complexity: "high",
    agentId: "coding",
    runtime: "rlm",
    toolAllowlist: ["shell", "write_file"],
    purposeTiers: { answer: "medium", synthesize: "large" },
  },
];
