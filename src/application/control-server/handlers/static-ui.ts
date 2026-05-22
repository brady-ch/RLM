import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import { join, normalize, relative, resolve, sep } from "node:path";

import { contentType } from "../http-utils.js";

export async function serveUiAsset(
  request: IncomingMessage,
  response: ServerResponse,
  uiDistDir: string | undefined,
): Promise<void> {
  if (!uiDistDir) {
    response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    response.end(
      '<!doctype html><title>RLM UI</title><div id="root">Build the React UI with npm run build:ui.</div>',
    );
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
    underDist.startsWith(`..${sep}`) ||
    underDist === ".." ||
    underDist.split(sep).includes("..")
  ) {
    response.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Forbidden");
    return;
  }
  try {
    const info = await stat(filePath);
    if (!info.isFile()) {
      serveIndex(response, uiDistDir);
      return;
    }
    response.writeHead(200, { "Content-Type": contentType(filePath) });
    createReadStream(filePath).pipe(response);
  } catch {
    serveIndex(response, uiDistDir);
  }
}

function serveIndex(response: ServerResponse, uiDistDir: string): void {
  response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  createReadStream(join(uiDistDir, "index.html")).pipe(response);
}
