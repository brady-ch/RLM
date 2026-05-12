import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { extname, join, normalize, relative, resolve, sep } from "node:path";
import type { AddressInfo } from "node:net";
import type { InteractiveExecutionSession } from "./execution-controller.js";
import type { ApprovalMode, DeleteStrategy } from "../domain/types.js";

export interface ControlServer {
  url: string;
  port: number;
  close(): Promise<void>;
}

export async function startControlServer(input: {
  session: InteractiveExecutionSession;
  port?: number | undefined;
  uiDistDir?: string | undefined;
}): Promise<ControlServer> {
  const server = createServer((request, response) => {
    void routeRequest(request, response, input.session, input.uiDistDir);
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(input.port ?? 0, "127.0.0.1", () => {
      server.off("error", reject);
      resolve();
    });
  });

  const address = server.address() as AddressInfo;
  return {
    port: address.port,
    url: `http://127.0.0.1:${address.port}`,
    close: () => new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    }),
  };
}

async function routeRequest(
  request: IncomingMessage,
  response: ServerResponse,
  session: InteractiveExecutionSession,
  uiDistDir: string | undefined,
): Promise<void> {
  const url = new URL(request.url ?? "/", "http://127.0.0.1");
  try {
    if (request.method === "GET" && url.pathname === "/api/session") {
      return sendJson(response, session.snapshot());
    }
    if (request.method === "GET" && url.pathname === "/api/run-mode") {
      const snapshot = session.snapshot();
      return sendJson(response, {
        approvalMode: snapshot.approvalMode,
        approvalModeLabel: toApprovalModeLabel(snapshot.approvalMode),
        autoApprovalPaused: snapshot.autoApprovalPaused,
      });
    }
    if (request.method === "GET" && url.pathname === "/api/graph") {
      return sendJson(response, session.snapshot().graph);
    }
    if (request.method === "GET" && url.pathname === "/api/events") {
      return streamEvents(response, session);
    }
    if (request.method === "POST" && url.pathname.match(/^\/api\/nodes\/[^/]+\/edit$/)) {
      const nodeId = decodeURIComponent(url.pathname.split("/")[3] ?? "");
      const body = await readJsonBody(request);
      session.editNodePrompt(nodeId, String(body["prompt"] ?? ""));
      return sendJson(response, session.snapshot());
    }
    if (request.method === "POST" && url.pathname.match(/^\/api\/nodes\/[^/]+\/model$/)) {
      const nodeId = decodeURIComponent(url.pathname.split("/")[3] ?? "");
      const body = await readJsonBody(request);
      session.setNodeModelOverride(nodeId, String(body["model"] ?? ""));
      return sendJson(response, session.snapshot());
    }
    if (request.method === "POST" && url.pathname.match(/^\/api\/nodes\/[^/]+\/plan$/)) {
      const nodeId = decodeURIComponent(url.pathname.split("/")[3] ?? "");
      const result = session.planNode(nodeId);
      return sendJson(response, { ...session.snapshot(), plan: result });
    }
    if (request.method === "POST" && url.pathname.match(/^\/api\/nodes\/[^/]+\/breakdown$/)) {
      const nodeId = decodeURIComponent(url.pathname.split("/")[3] ?? "");
      const result = session.planNode(nodeId);
      return sendJson(response, { ...session.snapshot(), plan: result });
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
      return sendJson(response, { ...session.snapshot(), budget });
    }
    if (request.method === "POST" && url.pathname.match(/^\/api\/nodes\/[^/]+\/approve$/)) {
      const nodeId = decodeURIComponent(url.pathname.split("/")[3] ?? "");
      const body = await readJsonBody(request);
      const token = typeof body["token"] === "string" ? body["token"] : undefined;
      const result = session.approveNode(nodeId, token);
      return sendJson(response, { ...session.snapshot(), duplicate: result.duplicate });
    }
    if (request.method === "POST" && url.pathname.match(/^\/api\/nodes\/[^/]+\/skip$/)) {
      const nodeId = decodeURIComponent(url.pathname.split("/")[3] ?? "");
      const body = await readJsonBody(request);
      const token = typeof body["token"] === "string" ? body["token"] : undefined;
      const result = session.skipNode(nodeId, token);
      return sendJson(response, { ...session.snapshot(), duplicate: result.duplicate });
    }
    if (request.method === "POST" && url.pathname === "/api/nodes/add") {
      const body = await readJsonBody(request);
      const parentId = String(body["parentId"] ?? "");
      const prompt = String(body["prompt"] ?? "");
      const kind = body["kind"] === "workflow-agent" || body["kind"] === "workflow-qa" ? body["kind"] : "task";
      const node = session.addNode({ parentId, prompt, kind });
      return sendJson(response, { ...session.snapshot(), addedNodeId: node.id });
    }
    if (request.method === "POST" && url.pathname.match(/^\/api\/nodes\/[^/]+\/connect$/)) {
      const nodeId = decodeURIComponent(url.pathname.split("/")[3] ?? "");
      const body = await readJsonBody(request);
      session.connectNode({ nodeId, parentId: String(body["parentId"] ?? "") });
      return sendJson(response, session.snapshot());
    }
    if (request.method === "POST" && url.pathname.match(/^\/api\/nodes\/[^/]+\/delete$/)) {
      const nodeId = decodeURIComponent(url.pathname.split("/")[3] ?? "");
      const body = await readJsonBody(request);
      const strategy = body["strategy"] === "rewire_dependents" || body["strategy"] === "delete_subtree"
        ? body["strategy"] as DeleteStrategy
        : undefined;
      const result = session.deleteNodeWithStrategy(nodeId, strategy);
      return sendJson(response, { ...session.snapshot(), deletedNodeIds: result.deleted });
    }
    if (request.method === "POST" && url.pathname === "/api/chat/message") {
      const body = await readJsonBody(request);
      const proposal = session.previewMutationFromChat(String(body["message"] ?? ""));
      return sendJson(response, { ...session.snapshot(), proposal });
    }
    if (request.method === "POST" && url.pathname === "/api/chat/apply") {
      const body = await readJsonBody(request);
      const proposalId = typeof body["proposalId"] === "string" ? body["proposalId"] : undefined;
      const deleteStrategy = body["deleteStrategy"] === "delete_subtree" || body["deleteStrategy"] === "rewire_dependents"
        ? body["deleteStrategy"] as DeleteStrategy
        : undefined;
      const applyInput: { proposalId?: string; deleteStrategy?: DeleteStrategy } = {};
      if (proposalId) {
        applyInput.proposalId = proposalId;
      }
      if (deleteStrategy) {
        applyInput.deleteStrategy = deleteStrategy;
      }
      const applied = session.applyPendingMutation(applyInput);
      return sendJson(response, { ...session.snapshot(), applied });
    }
    if (request.method === "POST" && url.pathname === "/api/chat/cancel") {
      session.clearPendingMutation();
      return sendJson(response, session.snapshot());
    }
    if (request.method === "POST" && url.pathname === "/api/chat/confirm-run") {
      const readiness = session.confirmGraphAndRun();
      return sendJson(response, { ...session.snapshot(), readiness });
    }
    if (request.method === "POST" && url.pathname === "/api/clarifications/ask") {
      const body = await readJsonBody(request);
      const question = session.raiseClarificationCheckpoint({
        nodeId: String(body["nodeId"] ?? ""),
        promptText: String(body["promptText"] ?? ""),
      });
      return sendJson(response, { ...session.snapshot(), question });
    }
    if (request.method === "POST" && url.pathname === "/api/clarifications/answer") {
      const body = await readJsonBody(request);
      const record = session.answerClarificationAndContinue({
        questionId: String(body["questionId"] ?? ""),
        userAnswer: String(body["userAnswer"] ?? ""),
      });
      return sendJson(response, { ...session.snapshot(), record });
    }
    if (request.method === "POST" && url.pathname === "/api/clarifications/abort") {
      const body = await readJsonBody(request);
      session.abortRunFromClarification({ questionId: String(body["questionId"] ?? "") });
      return sendJson(response, session.snapshot());
    }
    if (request.method === "POST" && url.pathname === "/api/stop") {
      const body = await readJsonBody(request);
      session.stop(typeof body["reason"] === "string" ? body["reason"] : undefined);
      return sendJson(response, session.snapshot());
    }
    if (request.method === "POST" && url.pathname === "/api/pause-future-auto-approvals") {
      const snapshot = session.snapshot();
      if (snapshot.status === "cancelled" || snapshot.status === "completed" || snapshot.status === "failed") {
        return sendJson(response, {
          error: "Cannot pause future auto-approvals after execution has finished.",
          approvalMode: snapshot.approvalMode,
          status: snapshot.status,
        }, 409);
      }
      session.pauseFutureAutoApprovals();
      const updated = session.snapshot();
      return sendJson(response, {
        ...updated,
        approvalModeLabel: toApprovalModeLabel(updated.approvalMode),
        message: "future auto-approvals paused",
      });
    }
    if (request.method === "POST" && url.pathname === "/api/approval-mode") {
      const body = await readJsonBody(request);
      const requested = body["approvalMode"];
      if (!isApprovalMode(requested)) {
        return sendJson(response, {
          error: "Invalid approval mode. Expected one of: full, initial-plan, initial-plan-recursive.",
          received: requested,
        }, 400);
      }
      // Mode is selected at session creation and exposed here for a stable API contract.
      const snapshot = session.snapshot();
      if (snapshot.approvalMode !== requested) {
        return sendJson(response, {
          error: "Approval mode cannot be changed after session start.",
          approvalMode: snapshot.approvalMode,
          requested,
        }, 409);
      }
      return sendJson(response, {
        approvalMode: snapshot.approvalMode,
        approvalModeLabel: toApprovalModeLabel(snapshot.approvalMode),
      });
    }

    return serveUiAsset(request, response, uiDistDir);
  } catch (error: unknown) {
    const mutationError = session.toMutationError(error);
    if (mutationError) {
      return sendJson(response, mutationError, 409);
    }
    const message = error instanceof Error ? error.message : String(error);
    const status = message.includes("Unknown node")
      ? 404
      : message.includes("Stale approval token") || message.includes("not awaiting approval")
        ? 409
        : 400;
    return sendJson(response, { error: message }, status);
  }
}

function streamEvents(response: ServerResponse, session: InteractiveExecutionSession): void {
  response.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  response.write(`event: snapshot\ndata: ${JSON.stringify(session.snapshot())}\n\n`);
  const unsubscribe = session.subscribe((event) => {
    response.write(`event: execution\ndata: ${JSON.stringify(event)}\n\n`);
  });
  response.on("close", unsubscribe);
}

async function serveUiAsset(request: IncomingMessage, response: ServerResponse, uiDistDir: string | undefined): Promise<void> {
  if (!uiDistDir) {
    response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    response.end("<!doctype html><title>RLM UI</title><div id=\"root\">Build the React UI with npm run build:ui.</div>");
    return;
  }

  const url = new URL(request.url ?? "/", "http://127.0.0.1");
  const root = resolve(uiDistDir);
  const relativeFromUrl =
    url.pathname === "/" || url.pathname === "" ? "index.html" : url.pathname.replace(/^\/+/u, "");
  const normalizedRel = normalize(relativeFromUrl).replace(/^(\.\.[/\\])+/u, "");
  const filePath = resolve(root, normalizedRel);
  const underDist = relative(root, filePath);
  if (
    underDist.startsWith(`..${sep}`)
    || underDist === ".."
    || underDist.split(sep).includes("..")
  ) {
    response.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Forbidden");
    return;
  }
  try {
    const info = await stat(filePath);
    if (!info.isFile()) {
      return serveIndex(response, uiDistDir);
    }
    response.writeHead(200, { "Content-Type": contentType(filePath) });
    createReadStream(filePath).pipe(response);
  } catch {
    return serveIndex(response, uiDistDir);
  }
}

function serveIndex(response: ServerResponse, uiDistDir: string): void {
  response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  createReadStream(join(uiDistDir, "index.html")).pipe(response);
}

async function readJsonBody(request: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const text = Buffer.concat(chunks).toString("utf8").trim();
  return text ? JSON.parse(text) as Record<string, unknown> : {};
}

function sendJson(response: ServerResponse, value: unknown, status = 200): void {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(value));
}

function contentType(filePath: string): string {
  switch (extname(filePath)) {
    case ".js":
      return "text/javascript; charset=utf-8";
    case ".css":
      return "text/css; charset=utf-8";
    case ".svg":
      return "image/svg+xml";
    case ".html":
      return "text/html; charset=utf-8";
    default:
      return "application/octet-stream";
  }
}

function isApprovalMode(value: unknown): value is ApprovalMode {
  return value === "full" || value === "initial-plan" || value === "initial-plan-recursive";
}

function toApprovalModeLabel(mode: ApprovalMode): string {
  switch (mode) {
    case "initial-plan":
      return "Initial plan";
    case "initial-plan-recursive":
      return "Initial plan + recursive";
    default:
      return "Full checkpoints";
  }
}
