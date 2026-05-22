import { createStderrRuntimeLogger } from "../../cli/runtime-logger.js";
import { installShutdownHandlers } from "../../cli/shutdown.js";
import {
  buildRuntimeContext as buildRuntimeContextCore,
  type BuildRuntimeContextOptions,
} from "../../runtime/composition/build-runtime-context.js";
import type { BuildRuntimeContextInput, RuntimeContext } from "./types.js";

export async function buildRuntimeContext(
  input: BuildRuntimeContextInput,
  options?: BuildRuntimeContextOptions,
): Promise<RuntimeContext> {
  return buildRuntimeContextCore(input, {
    ...options,
    cliWiring: {
      createLogger: (verbose) => (verbose ? createStderrRuntimeLogger() : undefined),
      installShutdown: installShutdownHandlers,
    },
  });
}
