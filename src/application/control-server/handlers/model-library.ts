import type { IncomingMessage, ServerResponse } from "node:http";

import type { ControlServerDeps } from "../control-server-deps.js";
import { readJsonBody, sendJson } from "../http-utils.js";

export async function tryModelLibraryRoutes(
  request: IncomingMessage,
  response: ServerResponse,
  deps: ControlServerDeps,
  url: URL,
): Promise<boolean> {
  const { modelLibrary } = deps;

  if (request.method === "GET" && url.pathname === "/api/model-library") {
    if (!modelLibrary) {
      sendJson(response, { error: "Model library is not configured." }, 404);
      return true;
    }
    sendJson(response, await modelLibrary.snapshot());
    return true;
  }
  if (request.method === "GET" && url.pathname === "/api/model-library/search") {
    if (!modelLibrary) {
      sendJson(response, { error: "Model library is not configured." }, 404);
      return true;
    }
    sendJson(response, await modelLibrary.searchHuggingFace(url.searchParams.get("q") ?? ""));
    return true;
  }
  if (request.method === "POST" && url.pathname === "/api/model-library/install") {
    if (!modelLibrary) {
      sendJson(response, { error: "Model library is not configured." }, 404);
      return true;
    }
    const body = await readJsonBody(request);
    sendJson(response, {
      job: modelLibrary.startInstall(String(body["model"] ?? "")),
      library: await modelLibrary.snapshot(),
    });
    return true;
  }
  if (request.method === "POST" && url.pathname === "/api/model-library/select-tier") {
    if (!modelLibrary) {
      sendJson(response, { error: "Model library is not configured." }, 404);
      return true;
    }
    const body = await readJsonBody(request);
    const tiers = modelLibrary.selectTier({
      tier: String(body["tier"] ?? ""),
      model: String(body["model"] ?? ""),
    });
    sendJson(response, { tiers, library: await modelLibrary.snapshot() });
    return true;
  }
  return false;
}
