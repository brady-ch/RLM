import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";

import type { ControlServerDeps } from "./control-server-deps.js";
import { dispatchRouteRequest } from "./route-request.js";
import type { ControlServer, StartControlServerInput } from "./types.js";

export type { SessionRuntimeRef, ControlServer, StartControlServerInput } from "./types.js";
export type { ControlServerDeps } from "./control-server-deps.js";
export { buildStartControlServerInput } from "./start-input-from-bootstrap.js";
export type { StartControlServerUiExtras } from "./start-input-from-bootstrap.js";

export async function startControlServer(input: StartControlServerInput): Promise<ControlServer> {
  const deps: ControlServerDeps = {
    session: input.session,
    uiDistDir: input.uiDistDir,
    modelLibrary: input.modelLibrary,
    memory: input.memory,
    sessionStore: input.sessionStore,
    sessionRuntime: input.sessionRuntime,
    projectRoot: input.projectRoot,
    onConfirmRun: input.onConfirmRun,
  };

  const server = createServer((request: IncomingMessage, response: ServerResponse) => {
    void dispatchRouteRequest(request, response, deps);
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
    close: () =>
      new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  };
}
