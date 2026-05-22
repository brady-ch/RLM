import { z } from "zod";
import { defaultQualityLoopConfig } from "./defaults.js";

const modelSelectionSchema = z.string().min(1);
const samplingOptionsSchema = z.object({
  temperature: z.number().optional(),
  topP: z.number().optional(),
  topK: z.number().int().positive().optional(),
  repeatPenalty: z.number().positive().optional(),
  maxTokens: z.number().int().positive().optional(),
  seed: z.number().int().optional(),
});

const agentModelsSchema = z
  .object({
    depth: modelSelectionSchema,
    classify: modelSelectionSchema,
    decompose: modelSelectionSchema,
    answer: modelSelectionSchema,
    summarize: modelSelectionSchema,
    synthesize: modelSelectionSchema,
    plan: modelSelectionSchema.optional(),
    quality_loop_draft: modelSelectionSchema.optional(),
    quality_loop_critique: modelSelectionSchema.optional(),
    quality_loop_refine: modelSelectionSchema.optional(),
    quality_loop_gate: modelSelectionSchema.optional(),
    quality_loop_best_of_progress: modelSelectionSchema.optional(),
  })
  .transform((models) => ({
    ...models,
    quality_loop_draft: models.quality_loop_draft ?? models.answer,
    quality_loop_critique: models.quality_loop_critique ?? models.answer,
    quality_loop_refine: models.quality_loop_refine ?? models.answer,
    quality_loop_gate: models.quality_loop_gate ?? models.answer,
    quality_loop_best_of_progress: models.quality_loop_best_of_progress ?? models.answer,
    plan: models.plan ?? models.decompose,
  }));

const qualityLoopSchema = z.object({
  enabled: z.boolean().default(false),
  maxIterations: z.number().int().positive().default(3),
  budgetBehavior: z
    .literal("stop_before_partial_iteration")
    .default("stop_before_partial_iteration"),
  phaseModels: z
    .object({
      draft: modelSelectionSchema.optional(),
      critique: modelSelectionSchema.optional(),
      refine: modelSelectionSchema.optional(),
      gate: modelSelectionSchema.optional(),
      best_of_progress: modelSelectionSchema.optional(),
    })
    .optional(),
});

const runtimeSchema = z.object({
  maxDepth: z.number().int().nonnegative().optional(),
  maxDynamicDepth: z.number().int().nonnegative().default(4),
  maxBranches: z.number().int().nonnegative().default(3),
  maxPromptCharacters: z.number().int().positive().default(6_000),
  maxModelCalls: z.number().int().nonnegative().default(24),
  maxToolRounds: z.number().int().nonnegative().default(3),
  qualityLoop: qualityLoopSchema.default(defaultQualityLoopConfig),
});

/** Internal parse schema — not re-exported from the project-config façade. */
export const configSchema = z.object({
  models: z.object({
    default: z.string().min(1),
    tiers: z.record(
      z.string(),
      z.object({
        name: z.string().min(1),
        estimatedRamMb: z.number().int().positive(),
      }),
    ),
    sampling: z
      .object({
        defaults: samplingOptionsSchema.optional(),
        modelProfiles: z.record(z.string().min(1), samplingOptionsSchema).default({}),
      })
      .optional(),
  }),
  memory: z.object({
    maxRamMb: z.union([z.literal("auto"), z.number().int().positive()]),
    reserveSystemRamMb: z.number().int().nonnegative(),
    waitForCapacity: z.boolean(),
    capacityCheckIntervalMs: z.number().int().positive(),
  }),
  runtime: runtimeSchema.default({
    maxDynamicDepth: 4,
    maxBranches: 3,
    maxPromptCharacters: 6_000,
    maxModelCalls: 24,
    maxToolRounds: 3,
    qualityLoop: defaultQualityLoopConfig,
  }),
  agents: z.record(
    z.string(),
    z.object({
      tools: z.array(z.string().min(1)),
      models: agentModelsSchema,
    }),
  ),
  workflows: z.record(
    z.string(),
    z.union([
      z.object({
        kind: z.literal("graph"),
        path: z.string().min(1).optional(),
        defaultVariant: z.enum(["playbook", "pipeline"]).optional(),
      }),
      z.object({
        mode: z.literal("ram_queue"),
        agents: z.array(z.string().min(1)).min(1),
        continueOnError: z.boolean().default(false),
        qa: z
          .object({
            agent: z.string().min(1),
            validationCommands: z.array(z.string().min(1)).default(["npm test", "npm run build"]),
            bugfixQueue: z
              .object({
                id: z.string().min(1).default("bugfix"),
                priority: z.number().int().default(100),
                highestPriorityKeywords: z
                  .array(z.string().min(1))
                  .default(["fail", "error", "regression", "broken", "crash"]),
              })
              .default({
                id: "bugfix",
                priority: 100,
                highestPriorityKeywords: ["fail", "error", "regression", "broken", "crash"],
              }),
          })
          .optional(),
        dispatch: z
          .object({
            strategy: z.literal("complexity_tiers"),
            tiers: z
              .array(
                z.object({
                  name: z.string().min(1),
                  maxEstimatedDepth: z.number().int().nonnegative().optional(),
                  agents: z.array(z.string().min(1)).min(1),
                  qa: z.boolean().default(false),
                }),
              )
              .min(1),
          })
          .optional(),
      }),
    ]),
  ),
  extensions: z
    .object({
      allowlist: z.string().optional(),
      load: z
        .array(
          z.object({
            path: z.string().min(1),
            agents: z.array(z.string().min(1)).default([]),
          }),
        )
        .default([]),
    })
    .optional(),
  interop: z
    .object({
      mcp: z
        .object({
          servers: z
            .array(
              z.object({
                id: z.string().min(1),
                command: z.string().min(1),
                args: z.array(z.string().min(1)).default([]),
                required: z.boolean().default(false),
              }),
            )
            .default([]),
        })
        .default({
          servers: [],
        }),
      skills: z
        .object({
          searchPaths: z.array(z.string().min(1)).default([".codex/skills", ".agents/skills"]),
          duplicateStrategy: z.literal("first_match").default("first_match"),
          cache: z.boolean().default(false),
          pathPolicies: z
            .array(
              z.object({
                path: z.string().min(1),
                strictness: z.enum(["strict", "lenient"]).default("strict"),
              }),
            )
            .default([]),
        })
        .default({
          searchPaths: [".codex/skills", ".agents/skills"],
          duplicateStrategy: "first_match",
          cache: false,
          pathPolicies: [],
        }),
    })
    .optional(),
  hosts: z
    .record(
      z.string().min(1),
      z.object({
        kind: z.enum(["ollama", "http"]),
        baseUrl: z.string().min(1),
        available: z.boolean().optional(),
        allowUnconstrainedToolCalls: z.boolean().optional(),
      }),
    )
    .optional(),
  runtimeHost: z.string().min(1).optional(),
});
