import { createInteractiveExecutionSession } from "../../application/execution-controller.js";
import { PurposeRoutingLanguageModel } from "../../application/model-provider.js";
import { resolveRuntimeHostSelection } from "../../application/project-config.js";
import { selectAgent } from "../../application/agent-registry.js";
import type { RuntimeContext } from "../../application/bootstrap/types.js";

export async function runPlanNodeMode(ctx: RuntimeContext): Promise<void> {
  const { options, registry, createModel, projectConfig } = ctx;
  const defaultAgent = selectAgent(registry, options.prompt, options.agent);
  const createPurposeRoutingModel = (): PurposeRoutingLanguageModel =>
    new PurposeRoutingLanguageModel({
      config: projectConfig,
      agent: defaultAgent.config,
      hostSelection: resolveRuntimeHostSelection(projectConfig, {
        cliHostId: options.host,
        env: process.env,
      }),
      createModel,
      logger: ctx.logger,
    });

  const session = createInteractiveExecutionSession({
    seedRootPrompt: options.prompt,
    planModel: createPurposeRoutingModel(),
  });
  try {
    const plan = await session.planNode(options.nodeId ?? "root-composer", {
      replan: options.replan,
    });
    const graph = session.snapshot().graph;
    console.log(
      JSON.stringify(
        {
          plannedNodeIds: plan.plannedNodeIds,
          budget: plan.budget,
          graphNodeCount: graph.nodes.length,
        },
        null,
        2,
      ),
    );
  } catch (error: unknown) {
    const mutationError = session.toMutationError(error);
    console.error(
      JSON.stringify(
        mutationError ?? { error: error instanceof Error ? error.message : String(error) },
        null,
        2,
      ),
    );
    process.exitCode = 1;
  }
}
