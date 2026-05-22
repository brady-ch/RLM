import type { InteractiveExecutionSession } from "../execution-controller.js";
import type { ModelLibraryService } from "../model-library.js";
import type { MemoryResolver } from "../memory-resolver.js";
import type { SessionStorePort } from "../../ports/session-store-port.js";
import type { FileMemoryStore, FileVectorIndex } from "../../adapters/index.js";

export interface SessionRuntimeRef {
  getRunId: () => string;
  setRunId: (runId: string) => void;
  memoryStore: FileMemoryStore;
  vectorIndex: FileVectorIndex;
  getMemory: () => MemoryResolver;
  setMemory: (memory: MemoryResolver) => void;
  createMemory: (runId: string) => MemoryResolver;
  embedProvider?: string | null;
}

export interface ControlServer {
  url: string;
  port: number;
  close(): Promise<void>;
}

export type StartControlServerInput = {
  session: InteractiveExecutionSession;
  port?: number | undefined;
  uiDistDir?: string | undefined;
  modelLibrary?: ModelLibraryService | undefined;
  memory?: MemoryResolver | undefined;
  sessionStore?: SessionStorePort | undefined;
  sessionRuntime?: SessionRuntimeRef | undefined;
  onConfirmRun?: ((session: InteractiveExecutionSession) => void | Promise<void>) | undefined;
  projectRoot?: string | undefined;
};
