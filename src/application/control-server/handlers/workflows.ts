import type { IncomingMessage, ServerResponse } from "node:http";

import {
  buildImportSessionSnapshot,
  importSidecarToGraph,
} from "../../graph-workflow-serializer.js";
import {
  exportAndSaveGraphWorkflow,
  listGraphWorkflows,
  loadGraphWorkflow,
} from "../../graph-workflow-store.js";
import type { GraphWorkflowSaveVariant } from "../../graph-workflow-types.js";
import type { ControlServerDeps } from "../control-server-deps.js";
import { readJsonBody, sendJson } from "../http-utils.js";

function parseSaveVariant(value: unknown): GraphWorkflowSaveVariant | undefined {
  if (value === "playbook" || value === "pipeline" || value === "both") {
    return value;
  }
  return undefined;
}

export async function tryGraphWorkflowRoutes(
  request: IncomingMessage,
  response: ServerResponse,
  deps: ControlServerDeps,
  url: URL,
): Promise<boolean> {
  const { session } = deps;
  const projectRoot = deps.projectRoot ?? process.cwd();

  if (request.method === "GET" && url.pathname === "/api/graph-workflows") {
    sendJson(response, {
      workflows: await listGraphWorkflows(projectRoot),
    });
    return true;
  }
  if (request.method === "POST" && url.pathname === "/api/graph-workflows/export") {
    const body = await readJsonBody(request);
    const workflowId = String(body["workflowId"] ?? "").trim();
    if (!workflowId) {
      sendJson(response, { error: "workflowId is required." }, 400);
      return true;
    }
    const variant = parseSaveVariant(body["variant"]);
    if (!variant) {
      sendJson(response, { error: "variant must be playbook, pipeline, or both." }, 400);
      return true;
    }
    const description = typeof body["description"] === "string" ? body["description"] : undefined;
    const saved = await exportAndSaveGraphWorkflow({
      workflowId,
      description,
      variant,
      graph: session.snapshot().graph,
      projectRoot,
    });
    session.patchGraphWorkflowMetadata({
      linkedWorkflowId: workflowId,
      lastVariant: variant,
      exportedAt: saved.sidecar.updatedAt,
    });
    sendJson(response, saved);
    return true;
  }
  if (request.method === "POST" && url.pathname === "/api/graph-workflows/import") {
    const body = await readJsonBody(request);
    const workflowId = String(body["workflowId"] ?? "").trim();
    if (!workflowId) {
      sendJson(response, { error: "workflowId is required." }, 400);
      return true;
    }
    try {
      const sidecar = await loadGraphWorkflow(workflowId, {
        projectRoot,
      });
      const imported = importSidecarToGraph(sidecar, "playbook");
      session.restoreSnapshot(buildImportSessionSnapshot(imported.graph));
      session.patchGraphWorkflowMetadata({
        linkedWorkflowId: workflowId,
        lastVariant: imported.variant,
      });
      sendJson(response, {
        ...session.snapshot(),
        workflowId,
        importedVariant: imported.variant,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      sendJson(response, { error: `Import failed: invalid graph workflow file. ${message}` }, 400);
    }
    return true;
  }
  return false;
}
