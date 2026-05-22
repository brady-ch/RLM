import type { FileMemoryStore, FileVectorIndex, VectorIndexRecord } from "../adapters/index.js";
import type { MemoryStorePort } from "../ports/memory-store-port.js";
import type { SavedSessionPayload } from "../ports/session-store-port.js";
import type { InteractiveExecutionSession } from "./execution-controller.js";
import type { GraphWorkflowSaveVariant, GraphWorkflowVariant } from "./graph-workflow-types.js";

export interface SavedGraphWorkflowMetadataSection {
  version: 1;
  linkedWorkflowId?: string | undefined;
  lastVariant?: GraphWorkflowSaveVariant | GraphWorkflowVariant | undefined;
  exportedAt?: string | undefined;
  restoreNote?: string | undefined;
}

export interface SavedMemorySection {
  version: 2;
  runId: string;
  status: "saved";
  scopes: Awaited<ReturnType<MemoryStorePort["listScopes"]>>;
  episodic: Awaited<ReturnType<MemoryStorePort["listEpisodic"]>>;
  audit: Awaited<ReturnType<MemoryStorePort["listAudit"]>>;
  packets: Awaited<ReturnType<MemoryStorePort["listPacketMetadata"]>>;
}

export interface SavedPreferencesSection {
  version: 2;
  status: "saved";
  preferences: Record<string, unknown>;
}

export interface SavedVectorIndexSection {
  version: 2;
  status: "indexed" | "empty" | "not_indexed";
  provider: string | null;
  runId: string;
  records: VectorIndexRecord[];
  rebuildNeeded: boolean;
}

export function readRunIdFromPayload(payload: SavedSessionPayload, fallback: string): string {
  const memory = payload.memory as Partial<SavedMemorySection> | null | undefined;
  if (memory && typeof memory.runId === "string" && memory.runId.trim().length > 0) {
    return memory.runId.trim();
  }
  return fallback;
}

export async function buildSavedSessionPayload(input: {
  snapshot: ReturnType<InteractiveExecutionSession["snapshot"]>;
  runId: string;
  memoryStore: MemoryStorePort;
  vectorIndex: FileVectorIndex;
  embedProvider?: string | null;
  graphWorkflowMetadata?: SavedGraphWorkflowMetadataSection | undefined;
}): Promise<SavedSessionPayload> {
  const artifactRefs: Array<{ nodeId: string; ref: unknown }> = [];
  for (const node of input.snapshot.graph.nodes) {
    for (const ref of node.composer?.artifactRefs ?? []) {
      artifactRefs.push({ nodeId: node.id, ref });
    }
  }

  const scopes = await input.memoryStore.listScopes(input.runId);
  const episodic = await input.memoryStore.listEpisodic(input.runId);
  const audit = await input.memoryStore.listAudit(input.runId);
  const packets = await input.memoryStore.listPacketMetadata(input.runId);
  const preferencesScope = await input.memoryStore.readScope(input.runId, "project-preferences");
  const allRecords = await input.vectorIndex.read();
  const sessionRecords = allRecords.filter((record) => record.sessionId === input.runId);

  const memory: SavedMemorySection = {
    version: 2,
    runId: input.runId,
    status: "saved",
    scopes,
    episodic,
    audit,
    packets,
  };

  const preferences: SavedPreferencesSection = {
    version: 2,
    status: "saved",
    preferences: preferencesScope?.content ?? {},
  };

  const vectorIndex: SavedVectorIndexSection = {
    version: 2,
    status: sessionRecords.length > 0 ? "indexed" : "empty",
    provider: input.embedProvider ?? null,
    runId: input.runId,
    records: sessionRecords,
    rebuildNeeded: sessionRecords.length === 0 && episodic.length > 0,
  };

  return {
    session: input.snapshot,
    artifacts: {
      version: 1,
      refs: artifactRefs,
      policy: "refs-only",
    },
    memory,
    preferences,
    vectorIndex,
    graphWorkflowMetadata: input.graphWorkflowMetadata ?? { version: 1 },
  };
}

export function restoreGraphWorkflowMetadata(payload: SavedSessionPayload): {
  metadata: SavedGraphWorkflowMetadataSection;
  degraded: boolean;
  note?: string;
} {
  const raw = payload.graphWorkflowMetadata as
    | Partial<SavedGraphWorkflowMetadataSection>
    | null
    | undefined;
  if (!raw || raw.version !== 1) {
    const note = "Session saved before v1.5 graph workflow metadata; workflow link not restored.";
    return {
      metadata: { version: 1, restoreNote: note },
      degraded: true,
      note,
    };
  }
  return {
    metadata: {
      version: 1,
      linkedWorkflowId: raw.linkedWorkflowId,
      lastVariant: raw.lastVariant,
      exportedAt: raw.exportedAt,
      restoreNote: raw.restoreNote,
    },
    degraded: false,
  };
}

export async function restoreSessionMemory(input: {
  payload: SavedSessionPayload;
  memoryStore: FileMemoryStore;
  vectorIndex: FileVectorIndex;
}): Promise<string> {
  const runId = readRunIdFromPayload(input.payload, `run-${Date.now()}`);
  const memory = input.payload.memory as Partial<SavedMemorySection> | null | undefined;
  if (memory?.version === 2 && memory.status === "saved") {
    await input.memoryStore.restoreSessionData(runId, {
      scopes: memory.scopes ?? [],
      episodic: memory.episodic ?? [],
      audit: memory.audit ?? [],
      packets: memory.packets ?? [],
    });
  }

  const vectorSection = input.payload.vectorIndex as
    | Partial<SavedVectorIndexSection>
    | null
    | undefined;
  if (vectorSection?.version === 2 && Array.isArray(vectorSection.records)) {
    await input.vectorIndex.mergeSessionRecords(runId, vectorSection.records);
  }

  return runId;
}
