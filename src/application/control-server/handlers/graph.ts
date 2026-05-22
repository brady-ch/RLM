import type { IncomingMessage, ServerResponse } from "node:http";

import type { DeleteStrategy } from "../../../domain/types.js";
import type { ControlServerDeps } from "../control-server-deps.js";
import { readJsonBody, sendJson } from "../http-utils.js";

function parseReplanChoice(value: unknown): "replace" | "merge" | "cancel" | undefined {
  return value === "replace" || value === "merge" || value === "cancel" ? value : undefined;
}

export async function tryGraphSnapshot(
  request: IncomingMessage,
  response: ServerResponse,
  deps: ControlServerDeps,
  url: URL,
): Promise<boolean> {
  if (request.method === "GET" && url.pathname === "/api/graph") {
    sendJson(response, deps.session.snapshot().graph);
    return true;
  }
  return false;
}

export async function tryGraphLayoutViewport(
  request: IncomingMessage,
  response: ServerResponse,
  deps: ControlServerDeps,
  url: URL,
): Promise<boolean> {
  const { session } = deps;
  if (request.method === "POST" && url.pathname === "/api/graph/layout") {
    const body = await readJsonBody(request);
    const raw = body["positions"];
    if (!raw || typeof raw !== "object") {
      sendJson(response, { error: "Expected positions object." }, 400);
      return true;
    }
    const positions: Record<string, { x: number; y: number }> = {};
    for (const [id, value] of Object.entries(raw as Record<string, unknown>)) {
      if (!value || typeof value !== "object") {
        continue;
      }
      const v = value as Record<string, unknown>;
      const x = Number(v["x"]);
      const y = Number(v["y"]);
      if (Number.isFinite(x) && Number.isFinite(y)) {
        positions[id] = { x, y };
      }
    }
    session.updateGraphLayout(positions);
    sendJson(response, session.snapshot());
    return true;
  }
  if (request.method === "POST" && url.pathname === "/api/graph/viewport") {
    const body = await readJsonBody(request);
    session.setGraphViewport({
      x: Number(body["x"] ?? 0),
      y: Number(body["y"] ?? 0),
      zoom: Number(body["zoom"] ?? 1),
    });
    sendJson(response, session.snapshot());
    return true;
  }
  return false;
}

/** Node-planning and graph manipulation routes (/api/nodes/*). */
export async function tryNodeRoutes(
  request: IncomingMessage,
  response: ServerResponse,
  deps: ControlServerDeps,
  url: URL,
): Promise<boolean> {
  const { session } = deps;
  if (request.method === "POST" && url.pathname.match(/^\/api\/nodes\/[^/]+\/edit$/)) {
    const nodeId = decodeURIComponent(url.pathname.split("/")[3] ?? "");
    const body = await readJsonBody(request);
    session.editNodePrompt(nodeId, String(body["prompt"] ?? ""));
    sendJson(response, session.snapshot());
    return true;
  }
  if (request.method === "POST" && url.pathname.match(/^\/api\/nodes\/[^/]+\/model$/)) {
    const nodeId = decodeURIComponent(url.pathname.split("/")[3] ?? "");
    const body = await readJsonBody(request);
    session.setNodeModelOverride(nodeId, String(body["model"] ?? ""));
    sendJson(response, session.snapshot());
    return true;
  }
  if (request.method === "POST" && url.pathname.match(/^\/api\/nodes\/[^/]+\/sampling$/)) {
    const nodeId = decodeURIComponent(url.pathname.split("/")[3] ?? "");
    const body = await readJsonBody(request);
    session.setNodeSamplingOverride(nodeId, body);
    sendJson(response, session.snapshot());
    return true;
  }
  if (request.method === "POST" && url.pathname.match(/^\/api\/nodes\/[^/]+\/expert$/)) {
    const nodeId = decodeURIComponent(url.pathname.split("/")[3] ?? "");
    const body = await readJsonBody(request);
    session.setNodeExpertOverride(nodeId, {
      agentId: typeof body["agentId"] === "string" ? body["agentId"] : undefined,
      runtime:
        body["runtime"] === "single-pass" || body["runtime"] === "rlm"
          ? body["runtime"]
          : undefined,
      toolAllowlist: Array.isArray(body["toolAllowlist"])
        ? body["toolAllowlist"].map(String)
        : undefined,
      purposeTiers:
        body["purposeTiers"] && typeof body["purposeTiers"] === "object"
          ? (body["purposeTiers"] as Record<string, string>)
          : undefined,
    });
    sendJson(response, session.snapshot());
    return true;
  }
  if (request.method === "POST" && url.pathname.match(/^\/api\/nodes\/[^/]+\/plan$/)) {
    const nodeId = decodeURIComponent(url.pathname.split("/")[3] ?? "");
    const body = await readJsonBody(request);
    const result = await session.planNode(nodeId, { replan: parseReplanChoice(body["replan"]) });
    sendJson(response, { ...session.snapshot(), plan: result });
    return true;
  }
  if (request.method === "POST" && url.pathname.match(/^\/api\/nodes\/[^/]+\/breakdown$/)) {
    const nodeId = decodeURIComponent(url.pathname.split("/")[3] ?? "");
    const body = await readJsonBody(request);
    const result = await session.planNode(nodeId, { replan: parseReplanChoice(body["replan"]) });
    sendJson(response, { ...session.snapshot(), plan: result });
    return true;
  }
  if (request.method === "POST" && url.pathname.match(/^\/api\/nodes\/[^/]+\/extend-budget$/)) {
    const nodeId = decodeURIComponent(url.pathname.split("/")[3] ?? "");
    const body = await readJsonBody(request);
    const maxDepth = typeof body["maxDepth"] === "number" ? body["maxDepth"] : undefined;
    const maxNodes = typeof body["maxNodes"] === "number" ? body["maxNodes"] : undefined;
    const extension: { maxDepth?: number; maxNodes?: number } = {};
    if (maxDepth !== undefined) {
      extension.maxDepth = maxDepth;
    }
    if (maxNodes !== undefined) {
      extension.maxNodes = maxNodes;
    }
    const budget = session.extendPlanBudget(nodeId, extension);
    sendJson(response, { ...session.snapshot(), budget });
    return true;
  }
  if (request.method === "POST" && url.pathname.match(/^\/api\/nodes\/[^/]+\/approve$/)) {
    const nodeId = decodeURIComponent(url.pathname.split("/")[3] ?? "");
    const body = await readJsonBody(request);
    const token = typeof body["token"] === "string" ? body["token"] : undefined;
    const result = session.approveNode(nodeId, token);
    sendJson(response, { ...session.snapshot(), duplicate: result.duplicate });
    return true;
  }
  if (request.method === "POST" && url.pathname.match(/^\/api\/nodes\/[^/]+\/skip$/)) {
    const nodeId = decodeURIComponent(url.pathname.split("/")[3] ?? "");
    const body = await readJsonBody(request);
    const token = typeof body["token"] === "string" ? body["token"] : undefined;
    const result = session.skipNode(nodeId, token);
    sendJson(response, { ...session.snapshot(), duplicate: result.duplicate });
    return true;
  }
  if (
    request.method === "POST" &&
    url.pathname.match(/^\/api\/nodes\/[^/]+\/quality-loop\/accept$/)
  ) {
    const nodeId = decodeURIComponent(url.pathname.split("/")[3] ?? "");
    const body = await readJsonBody(request);
    session.acceptQualityLoop(
      nodeId,
      typeof body["reason"] === "string" ? body["reason"] : undefined,
    );
    sendJson(response, session.snapshot());
    return true;
  }
  if (
    request.method === "POST" &&
    url.pathname.match(/^\/api\/nodes\/[^/]+\/quality-loop\/stop$/)
  ) {
    const nodeId = decodeURIComponent(url.pathname.split("/")[3] ?? "");
    const body = await readJsonBody(request);
    session.stopQualityLoop(
      nodeId,
      typeof body["reason"] === "string" ? body["reason"] : undefined,
    );
    sendJson(response, session.snapshot());
    return true;
  }
  if (request.method === "POST" && url.pathname === "/api/nodes/add") {
    const body = await readJsonBody(request);
    const parentId = String(body["parentId"] ?? "");
    const prompt = String(body["prompt"] ?? "");
    const kind =
      body["kind"] === "workflow-agent" || body["kind"] === "workflow-qa" ? body["kind"] : "task";
    const node = session.addNode({ parentId, prompt, kind });
    sendJson(response, { ...session.snapshot(), addedNodeId: node.id });
    return true;
  }
  if (request.method === "POST" && url.pathname.match(/^\/api\/nodes\/[^/]+\/connect$/)) {
    const nodeId = decodeURIComponent(url.pathname.split("/")[3] ?? "");
    const body = await readJsonBody(request);
    const connectInput: {
      nodeId: string;
      parentId: string;
      sourceHandle?: string;
      targetHandle?: string;
    } = {
      nodeId,
      parentId: String(body["parentId"] ?? ""),
    };
    if (typeof body["sourceHandle"] === "string") {
      connectInput.sourceHandle = body["sourceHandle"];
    }
    if (typeof body["targetHandle"] === "string") {
      connectInput.targetHandle = body["targetHandle"];
    }
    session.connectNode(connectInput);
    sendJson(response, session.snapshot());
    return true;
  }
  if (request.method === "POST" && url.pathname.match(/^\/api\/nodes\/[^/]+\/delete$/)) {
    const nodeId = decodeURIComponent(url.pathname.split("/")[3] ?? "");
    const body = await readJsonBody(request);
    const strategy =
      body["strategy"] === "rewire_dependents" || body["strategy"] === "delete_subtree"
        ? (body["strategy"] as DeleteStrategy)
        : undefined;
    const result = session.deleteNodeWithStrategy(nodeId, strategy);
    sendJson(response, { ...session.snapshot(), deletedNodeIds: result.deleted });
    return true;
  }
  return false;
}
