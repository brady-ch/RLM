import type { InteractiveExecutionSession } from "../execution-controller.js";
import type { ModelLibraryService } from "../model-library.js";
import type { MemoryResolver } from "../memory-resolver.js";
import type { SessionStorePort } from "../../ports/session-store-port.js";
import type { SessionRuntimeRef } from "./types.js";
import type { PluginRegistryService } from "../plugins/plugin-registry-service.js";

/**
 * Frozen per-server dependency bag wired at composition time (`startControlServer`).
 * Route handlers map HTTP to application services — they do not construct stores or resolvers here.
 */
export type ControlServerDeps = {
  session: InteractiveExecutionSession;
  uiDistDir?: string | undefined;
  modelLibrary?: ModelLibraryService | undefined;
  memory?: MemoryResolver | undefined;
  sessionStore?: SessionStorePort | undefined;
  sessionRuntime?: SessionRuntimeRef | undefined;
  projectRoot?: string | undefined;
  pluginRegistry?: PluginRegistryService | undefined;
  onConfirmRun?: ((session: InteractiveExecutionSession) => void | Promise<void>) | undefined;
};
