import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { extname, join, normalize } from "node:path";
import type { AddressInfo } from "node:net";
import type { InteractiveExecutionSession } from "./execution-controller.js";

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
    if (request.method === "POST" && url.pathname.match(/^\/api\/nodes\/[^/]+\/approve$/)) {
      const nodeId = decodeURIComponent(url.pathname.split("/")[3] ?? "");
      session.approveNode(nodeId);
      return sendJson(response, session.snapshot());
    }
    if (request.method === "POST" && url.pathname.match(/^\/api\/nodes\/[^/]+\/skip$/)) {
      const nodeId = decodeURIComponent(url.pathname.split("/")[3] ?? "");
      session.skipNode(nodeId);
      return sendJson(response, session.snapshot());
    }
    if (request.method === "POST" && url.pathname === "/api/stop") {
      const body = await readJsonBody(request);
      session.stop(typeof body["reason"] === "string" ? body["reason"] : undefined);
      return sendJson(response, session.snapshot());
    }

    return serveUiAsset(request, response, uiDistDir);
  } catch (error: unknown) {
    return sendJson(response, { error: error instanceof Error ? error.message : String(error) }, 400);
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
  const requestedPath = url.pathname === "/" ? "/index.html" : url.pathname;
  const normalized = normalize(requestedPath).replace(/^(\.\.[/\\])+/, "");
  const filePath = join(uiDistDir, normalized);
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
