// Intentional boundary violation probe — excluded from npm run depcruise:strict; used by tests/depcruise meta-tests only.
import type { AgentRegistry } from "../../application/agent-registry.js";

export type ForbiddenPluginImportProbe = AgentRegistry;
