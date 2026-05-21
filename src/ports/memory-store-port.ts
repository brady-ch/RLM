export type MemoryScopeLifetime = "session" | "project" | "permanent";

export interface MemoryScopeDocument {
  sessionId: string;
  scopeId: string;
  lifetime: MemoryScopeLifetime;
  version: number;
  content: Record<string, unknown>;
  updatedAt: string;
}

export interface MemoryScopePatchRequest {
  sessionId: string;
  scopeId: string;
  actor: string;
  expectedVersion: number;
  allowedScopes: string[];
  writes: string[];
  patch: Record<string, unknown>;
  lifetime?: MemoryScopeLifetime | undefined;
}

export interface MemoryScopePatchResult {
  accepted: boolean;
  reason: string;
  nextVersion: number;
  auditSeq: number;
}

export interface MemoryAuditRecord {
  seq: number;
  sessionId: string;
  scopeId: string;
  actor: string;
  accepted: boolean;
  reason: string;
  timestamp: string;
}

export interface EpisodicMemoryEntry {
  id: string;
  sessionId: string;
  nodeId?: string | undefined;
  type: "node_event" | "summary" | "scope_write" | "rejected_write" | "degraded";
  summary: string;
  artifactRefs?: string[] | undefined;
  scopeIds?: string[] | undefined;
  timestamp: string;
}

export interface MemoryPacketMetadata {
  sessionId: string;
  nodeId: string;
  scopeIds: string[];
  charLimit: number;
  charsUsed: number;
  truncated: boolean;
  degraded: boolean;
  reasons: string[];
  provenance: Array<{ kind: "scope" | "episodic"; id: string; version?: number | undefined }>;
  createdAt: string;
}

export interface MemoryStorePort {
  readScope(sessionId: string, scopeId: string): Promise<MemoryScopeDocument | undefined>;
  listScopes(sessionId: string): Promise<MemoryScopeDocument[]>;
  patchScope(request: MemoryScopePatchRequest): Promise<MemoryScopePatchResult>;
  listAudit(sessionId: string): Promise<MemoryAuditRecord[]>;
  appendEpisodic(entry: EpisodicMemoryEntry): Promise<void>;
  listEpisodic(sessionId: string): Promise<EpisodicMemoryEntry[]>;
  getRollingSummary(sessionId: string, scopeIds: string[], maxChars: number): Promise<string>;
  recordPacketMetadata(metadata: MemoryPacketMetadata): Promise<void>;
  listPacketMetadata(sessionId: string): Promise<MemoryPacketMetadata[]>;
  getLastPacketMetadata(sessionId: string, nodeId: string): Promise<MemoryPacketMetadata | undefined>;
}
