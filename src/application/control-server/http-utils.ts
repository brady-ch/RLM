import { extname } from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";

/** Max JSON body size for control server POST bodies (local server hardening). */
export const MAX_CONTROL_JSON_BODY_BYTES = 1024 * 1024;

export async function readJsonBody(request: IncomingMessage): Promise<Record<string, unknown>> {
  const rawLen = request.headers["content-length"];
  if (rawLen !== undefined) {
    const n = Number.parseInt(String(rawLen), 10);
    if (!Number.isFinite(n) || n > MAX_CONTROL_JSON_BODY_BYTES) {
      throw new Error(`Request body exceeds ${MAX_CONTROL_JSON_BODY_BYTES} byte limit.`);
    }
  }
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of request) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buf.length;
    if (total > MAX_CONTROL_JSON_BODY_BYTES) {
      throw new Error(`Request body exceeds ${MAX_CONTROL_JSON_BODY_BYTES} byte limit.`);
    }
    chunks.push(buf);
  }
  const text = Buffer.concat(chunks).toString("utf8").trim();
  return text ? (JSON.parse(text) as Record<string, unknown>) : {};
}

export function sendJson(response: ServerResponse, value: unknown, status = 200): void {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(value));
}

export function contentType(filePath: string): string {
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
