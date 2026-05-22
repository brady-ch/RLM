import type { IncomingMessage, ServerResponse } from "node:http";

import type { ControlServerDeps } from "./control-server-deps.js";
import * as graphHandlers from "./handlers/graph.js";
import * as workflowsHandlers from "./handlers/workflows.js";
import * as modelLibraryHandlers from "./handlers/model-library.js";
import * as pluginsHandlers from "./handlers/plugins.js";
import * as sessionHandlers from "./handlers/session.js";
import { serveUiAsset } from "./handlers/static-ui.js";
import { sendJson } from "./http-utils.js";

type RouteProbe = (
  req: IncomingMessage,
  res: ServerResponse,
  d: ControlServerDeps,
  u: URL,
) => Promise<boolean>;

/**
 * HTTP dispatch with legacy route precedence preserved across surface modules (session/graph/workflows/model-library/static).
 */
export async function dispatchRouteRequest(
  request: IncomingMessage,
  response: ServerResponse,
  deps: ControlServerDeps,
): Promise<void> {
  const url = new URL(request.url ?? "/", "http://127.0.0.1");
  try {
    const chain: RouteProbe[] = [
      sessionHandlers.trySessionRunModeSnapshot,
      graphHandlers.tryGraphSnapshot,
      sessionHandlers.trySavedSessionsRootList,
      workflowsHandlers.tryGraphWorkflowRoutes,
      sessionHandlers.tryMemoryRoutes,
      sessionHandlers.trySavedSessionsDetail,
      modelLibraryHandlers.tryModelLibraryRoutes,
      pluginsHandlers.tryPluginRoutes,
      graphHandlers.tryGraphLayoutViewport,
      sessionHandlers.tryEventsStream,
      graphHandlers.tryNodeRoutes,
      sessionHandlers.tryChatClarifyStopApproval,
    ];
    for (const handle of chain) {
      if (await handle(request, response, deps, url)) {
        return;
      }
    }
    await serveUiAsset(request, response, deps.uiDistDir);
  } catch (error: unknown) {
    const mutationError = deps.session.toMutationError(error);
    if (mutationError) {
      sendJson(response, mutationError, 409);
      return;
    }
    const message = error instanceof Error ? error.message : String(error);
    const status = message.includes("Unknown node")
      ? 404
      : message.includes("Stale approval token") || message.includes("not awaiting approval")
        ? 409
        : 400;
    sendJson(response, { error: message }, status);
  }
}
