import type { IncomingMessage, ServerResponse } from "node:http";

import type { ControlServerDeps } from "../control-server-deps.js";
import { readJsonBody, sendJson } from "../http-utils.js";

export async function tryPluginRoutes(
  request: IncomingMessage,
  response: ServerResponse,
  deps: ControlServerDeps,
  url: URL,
): Promise<boolean> {
  const { pluginRegistry } = deps;
  if (!pluginRegistry) {
    return false;
  }

  if (request.method === "GET" && url.pathname === "/api/plugins") {
    sendJson(response, { plugins: await pluginRegistry.list() });
    return true;
  }

  if (request.method === "GET" && url.pathname === "/api/plugins/doctor") {
    sendJson(response, await pluginRegistry.doctor());
    return true;
  }

  if (request.method === "POST" && url.pathname === "/api/plugins/doctor/fix") {
    sendJson(response, await pluginRegistry.doctor({ fix: true }));
    return true;
  }

  const inspectMatch = url.pathname.match(/^\/api\/plugins\/([^/]+)\/inspect$/u);
  if (request.method === "GET" && inspectMatch?.[1]) {
    sendJson(response, await pluginRegistry.inspect(decodeURIComponent(inspectMatch[1])));
    return true;
  }

  if (request.method === "POST" && url.pathname === "/api/plugins/install") {
    const body = await readJsonBody(request);
    const path = String(body["path"] ?? body["source"] ?? body["url"] ?? "");
    const confirm = body["confirm"] === true || body["yes"] === true;
    if (!path) {
      sendJson(response, { error: "Missing path or url." }, 400);
      return true;
    }
    sendJson(response, await pluginRegistry.install(path, { confirm }));
    return true;
  }

  if (request.method === "POST" && url.pathname === "/api/plugins/enable") {
    const body = await readJsonBody(request);
    const id = String(body["id"] ?? "");
    if (!id) {
      sendJson(response, { error: "Missing id." }, 400);
      return true;
    }
    sendJson(response, await pluginRegistry.enable(id));
    return true;
  }

  if (request.method === "POST" && url.pathname === "/api/plugins/disable") {
    const body = await readJsonBody(request);
    const id = String(body["id"] ?? "");
    if (!id) {
      sendJson(response, { error: "Missing id." }, 400);
      return true;
    }
    sendJson(response, await pluginRegistry.disable(id));
    return true;
  }

  if (request.method === "POST" && url.pathname === "/api/plugins/uninstall") {
    const body = await readJsonBody(request);
    const id = String(body["id"] ?? "");
    if (!id) {
      sendJson(response, { error: "Missing id." }, 400);
      return true;
    }
    sendJson(response, await pluginRegistry.uninstall(id));
    return true;
  }

  if (request.method === "POST" && url.pathname === "/api/plugins/validate") {
    const body = await readJsonBody(request);
    const path = String(body["path"] ?? "");
    if (!path) {
      sendJson(response, { error: "Missing path." }, 400);
      return true;
    }
    sendJson(response, { ok: true, manifest: await pluginRegistry.validatePath(path) });
    return true;
  }

  return false;
}
