import type { IncomingMessage, ServerResponse } from "node:http";

import type { InteractiveExecutionSession } from "../../execution-controller.js";
import type { ApprovalMode, DeleteStrategy } from "../../../domain/types.js";
import type { SavedSessionPayload } from "../../../ports/session-store-port.js";
import type { MemoryResolver } from "../../memory-resolver.js";
import {
  buildSavedSessionPayload,
  restoreGraphWorkflowMetadata,
  restoreSessionMemory,
} from "../../session-memory-bridge.js";
import {
  applyPipelineTemplate,
  buildImportSessionSnapshot,
  graphHasPipelineTemplate,
} from "../../graph-workflow-serializer.js";
import type { ControlServerDeps } from "../control-server-deps.js";
import { readJsonBody, sendJson } from "../http-utils.js";

export async function trySessionRunModeSnapshot(
  request: IncomingMessage,
  response: ServerResponse,
  deps: ControlServerDeps,
  url: URL,
): Promise<boolean> {
  const { session } = deps;
  if (request.method === "GET" && url.pathname === "/api/session") {
    sendJson(response, session.snapshot());
    return true;
  }
  if (request.method === "GET" && url.pathname === "/api/run-mode") {
    const snapshot = session.snapshot();
    sendJson(response, {
      approvalMode: snapshot.approvalMode,
      approvalModeLabel: toApprovalModeLabel(snapshot.approvalMode),
      autoApprovalPaused: snapshot.autoApprovalPaused,
    });
    return true;
  }
  return false;
}

export async function trySavedSessionsRootList(
  request: IncomingMessage,
  response: ServerResponse,
  deps: ControlServerDeps,
  url: URL,
): Promise<boolean> {
  if (request.method === "GET" && url.pathname === "/api/saved-sessions") {
    const { sessionStore } = deps;
    if (!sessionStore) {
      sendJson(response, { error: "Saved sessions are not configured." }, 404);
      return true;
    }
    sendJson(response, { sessions: await sessionStore.list() });
    return true;
  }
  return false;
}

export async function tryMemoryRoutes(
  request: IncomingMessage,
  response: ServerResponse,
  deps: ControlServerDeps,
  url: URL,
): Promise<boolean> {
  const activeMemory = (): MemoryResolver | undefined =>
    deps.sessionRuntime?.getMemory() ?? deps.memory;

  if (request.method === "GET" && url.pathname === "/api/memory") {
    const resolvedMemory = activeMemory();
    if (!resolvedMemory) {
      sendJson(response, { error: "Memory inspection is not configured." }, 404);
      return true;
    }
    sendJson(response, await resolvedMemory.inspect());
    return true;
  }
  if (request.method === "POST" && url.pathname === "/api/memory/preferences") {
    const resolvedMemory = activeMemory();
    if (!resolvedMemory) {
      sendJson(response, { error: "Memory inspection is not configured." }, 404);
      return true;
    }
    const body = await readJsonBody(request);
    await resolvedMemory.setPreference({
      key: String(body["key"] ?? ""),
      value: String(body["value"] ?? ""),
      source: "ui",
      lifetime: body["lifetime"] === "permanent" ? "permanent" : "project",
    });
    sendJson(response, await resolvedMemory.inspect());
    return true;
  }
  if (request.method === "DELETE" && url.pathname.match(/^\/api\/memory\/preferences\/[^/]+$/)) {
    const resolvedMemory = activeMemory();
    if (!resolvedMemory) {
      sendJson(response, { error: "Memory inspection is not configured." }, 404);
      return true;
    }
    const key = decodeURIComponent(url.pathname.split("/")[4] ?? "");
    await resolvedMemory.deletePreference({ key });
    sendJson(response, await resolvedMemory.inspect());
    return true;
  }
  return false;
}

export async function trySavedSessionsDetail(
  request: IncomingMessage,
  response: ServerResponse,
  deps: ControlServerDeps,
  url: URL,
): Promise<boolean> {
  const { session } = deps;
  const { sessionRuntime, sessionStore } = deps;
  if (request.method === "POST" && url.pathname === "/api/saved-sessions/save") {
    if (!sessionStore) {
      sendJson(response, { error: "Saved sessions are not configured." }, 404);
      return true;
    }
    const body = await readJsonBody(request);
    const snapshot = session.snapshot();
    const payload = sessionRuntime
      ? await buildSavedSessionPayload({
          snapshot,
          runId: sessionRuntime.getRunId(),
          memoryStore: sessionRuntime.memoryStore,
          vectorIndex: sessionRuntime.vectorIndex,
          embedProvider: sessionRuntime.embedProvider ?? null,
          graphWorkflowMetadata: session.getGraphWorkflowMetadata(),
        })
      : legacySavedSessionPayload(snapshot);
    const saved = await sessionStore.save({
      id: typeof body["id"] === "string" ? body["id"] : undefined,
      name: typeof body["name"] === "string" ? body["name"] : undefined,
      payload,
    });
    sendJson(response, saved);
    return true;
  }
  if (request.method === "GET" && url.pathname.match(/^\/api\/saved-sessions\/[^/]+$/)) {
    if (!sessionStore) {
      sendJson(response, { error: "Saved sessions are not configured." }, 404);
      return true;
    }
    const sessionId = decodeURIComponent(url.pathname.split("/")[3] ?? "");
    sendJson(response, await sessionStore.load(sessionId));
    return true;
  }
  if (request.method === "POST" && url.pathname.match(/^\/api\/saved-sessions\/[^/]+\/open$/)) {
    if (!sessionStore) {
      sendJson(response, { error: "Saved sessions are not configured." }, 404);
      return true;
    }
    const sessionId = decodeURIComponent(url.pathname.split("/")[3] ?? "");
    const saved = await sessionStore.load(sessionId);
    if (saved.verification.status !== "complete") {
      sendJson(
        response,
        {
          error: "Saved session restore is unsafe.",
          savedSession: saved,
        },
        409,
      );
      return true;
    }
    if (sessionRuntime) {
      const runId = await restoreSessionMemory({
        payload: saved.payload,
        memoryStore: sessionRuntime.memoryStore,
        vectorIndex: sessionRuntime.vectorIndex,
      });
      sessionRuntime.setRunId(runId);
      sessionRuntime.setMemory(sessionRuntime.createMemory(runId));
    }
    session.restoreSnapshot(
      saved.payload.session as ReturnType<InteractiveExecutionSession["snapshot"]>,
    );
    const metadataRestore = restoreGraphWorkflowMetadata(saved.payload);
    session.setGraphWorkflowMetadata(metadataRestore.metadata);
    sendJson(response, {
      ...session.snapshot(),
      savedSession: saved,
      graphWorkflowMetadataRestore: metadataRestore.degraded
        ? { degraded: true, note: metadataRestore.note }
        : { degraded: false },
    });
    return true;
  }
  return false;
}

export async function tryEventsStream(
  request: IncomingMessage,
  response: ServerResponse,
  deps: ControlServerDeps,
  url: URL,
): Promise<boolean> {
  if (request.method === "GET" && url.pathname === "/api/events") {
    streamEvents(response, deps.session);
    return true;
  }
  return false;
}

export async function tryChatClarifyStopApproval(
  request: IncomingMessage,
  response: ServerResponse,
  deps: ControlServerDeps,
  url: URL,
): Promise<boolean> {
  const { session, onConfirmRun } = deps;

  if (request.method === "POST" && url.pathname === "/api/chat/message") {
    const body = await readJsonBody(request);
    const proposal = session.previewMutationFromChat(String(body["message"] ?? ""));
    sendJson(response, { ...session.snapshot(), proposal });
    return true;
  }
  if (request.method === "POST" && url.pathname === "/api/chat/apply") {
    const body = await readJsonBody(request);
    const proposalId = typeof body["proposalId"] === "string" ? body["proposalId"] : undefined;
    const deleteStrategy =
      body["deleteStrategy"] === "delete_subtree" || body["deleteStrategy"] === "rewire_dependents"
        ? (body["deleteStrategy"] as DeleteStrategy)
        : undefined;
    const applyInput: { proposalId?: string; deleteStrategy?: DeleteStrategy } = {};
    if (proposalId) {
      applyInput.proposalId = proposalId;
    }
    if (deleteStrategy) {
      applyInput.deleteStrategy = deleteStrategy;
    }
    const applied = session.applyPendingMutation(applyInput);
    sendJson(response, { ...session.snapshot(), applied });
    return true;
  }
  if (request.method === "POST" && url.pathname === "/api/chat/cancel") {
    session.clearPendingMutation();
    sendJson(response, session.snapshot());
    return true;
  }
  if (request.method === "POST" && url.pathname === "/api/chat/confirm-run") {
    const body = await readJsonBody(request);
    const runVariant = body["variant"] === "pipeline" ? "pipeline" : "playbook";
    const taskInput = typeof body["input"] === "string" ? body["input"].trim() : "";
    if (runVariant === "pipeline" && taskInput.length > 0) {
      const currentGraph = session.snapshot().graph;
      if (graphHasPipelineTemplate(currentGraph)) {
        session.restoreSnapshot(
          buildImportSessionSnapshot(applyPipelineTemplate(currentGraph, { input: taskInput })),
        );
      }
    }
    const readiness = session.confirmGraphAndRun();
    if (
      readiness.state === "ready_to_run" &&
      onConfirmRun &&
      !session.isConfirmedExecutionRunning()
    ) {
      void Promise.resolve(onConfirmRun(session)).catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        session.stop(typeof message === "string" ? message : "UI execution failed");
      });
    }
    sendJson(response, { ...session.snapshot(), readiness, runVariant });
    return true;
  }
  if (request.method === "POST" && url.pathname === "/api/clarifications/ask") {
    const body = await readJsonBody(request);
    const question = session.raiseClarificationCheckpoint({
      nodeId: String(body["nodeId"] ?? ""),
      promptText: String(body["promptText"] ?? ""),
    });
    sendJson(response, { ...session.snapshot(), question });
    return true;
  }
  if (request.method === "POST" && url.pathname === "/api/clarifications/answer") {
    const body = await readJsonBody(request);
    const record = session.answerClarificationAndContinue({
      questionId: String(body["questionId"] ?? ""),
      userAnswer: String(body["userAnswer"] ?? ""),
    });
    sendJson(response, { ...session.snapshot(), record });
    return true;
  }
  if (request.method === "POST" && url.pathname === "/api/clarifications/abort") {
    const body = await readJsonBody(request);
    session.abortRunFromClarification({ questionId: String(body["questionId"] ?? "") });
    sendJson(response, session.snapshot());
    return true;
  }
  if (request.method === "POST" && url.pathname === "/api/stop") {
    const body = await readJsonBody(request);
    session.stop(typeof body["reason"] === "string" ? body["reason"] : undefined);
    sendJson(response, session.snapshot());
    return true;
  }
  if (request.method === "POST" && url.pathname === "/api/pause-future-auto-approvals") {
    const snapshot = session.snapshot();
    if (
      snapshot.status === "cancelled" ||
      snapshot.status === "completed" ||
      snapshot.status === "failed"
    ) {
      sendJson(
        response,
        {
          error: "Cannot pause future auto-approvals after execution has finished.",
          approvalMode: snapshot.approvalMode,
          status: snapshot.status,
        },
        409,
      );
      return true;
    }
    session.pauseFutureAutoApprovals();
    const updated = session.snapshot();
    sendJson(response, {
      ...updated,
      approvalModeLabel: toApprovalModeLabel(updated.approvalMode),
      message: "future auto-approvals paused",
    });
    return true;
  }
  if (request.method === "POST" && url.pathname === "/api/approval-mode") {
    const body = await readJsonBody(request);
    const requested = body["approvalMode"];
    if (!isApprovalMode(requested)) {
      sendJson(
        response,
        {
          error:
            "Invalid approval mode. Expected one of: full, initial-plan, initial-plan-recursive.",
          received: requested,
        },
        400,
      );
      return true;
    }
    const snapshot = session.snapshot();
    if (snapshot.approvalMode !== requested) {
      sendJson(
        response,
        {
          error: "Approval mode cannot be changed after session start.",
          approvalMode: snapshot.approvalMode,
          requested,
        },
        409,
      );
      return true;
    }
    sendJson(response, {
      approvalMode: snapshot.approvalMode,
      approvalModeLabel: toApprovalModeLabel(snapshot.approvalMode),
    });
    return true;
  }
  return false;
}

function legacySavedSessionPayload(
  snapshot: ReturnType<InteractiveExecutionSession["snapshot"]>,
): SavedSessionPayload {
  const artifactRefs: Array<{ nodeId: string; ref: unknown }> = [];
  for (const node of snapshot.graph.nodes) {
    for (const ref of node.composer?.artifactRefs ?? []) {
      artifactRefs.push({ nodeId: node.id, ref });
    }
  }
  return {
    session: snapshot,
    artifacts: {
      version: 1,
      refs: artifactRefs,
      policy: "refs-only",
    },
    memory: {
      version: 1,
      status: "structured_contract_saved",
      scopes: [
        ...new Set(
          snapshot.graph.nodes.flatMap((node) => node.composer?.contextPolicy.memoryScopes ?? []),
        ),
      ],
      contextPolicies: snapshot.graph.nodes
        .filter((node) => node.composer?.contextPolicy)
        .map((node) => ({ nodeId: node.id, policy: node.composer?.contextPolicy })),
      note: "Runtime structured memory and rolling episodic summaries are stored under .rlm/memory by run id.",
    },
    preferences: {
      version: 1,
      status: "contract_saved",
      preferences: [],
      note: "Preference edit/apply behavior is implemented in Phase 27.",
    },
    vectorIndex: {
      version: 1,
      status: "not_indexed",
      provider: null,
      indexManifest: null,
      rebuildNeeded: true,
      note: "Vector retrieval behavior is implemented in Phase 28.",
    },
  };
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
