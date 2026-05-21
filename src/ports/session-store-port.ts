export type SavedSessionRestoreStatus = "complete" | "degraded" | "failed";

export interface SavedSessionSectionStatus {
  name: string;
  status: SavedSessionRestoreStatus;
  path: string;
  version?: number | undefined;
  reason?: string | undefined;
}

export interface SavedSessionVerification {
  status: SavedSessionRestoreStatus;
  sections: SavedSessionSectionStatus[];
  missing: string[];
  corrupt: Array<{ section: string; reason: string }>;
  unsafeToContinue: boolean;
}

export interface SavedSessionSummary {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  status: SavedSessionRestoreStatus;
  path: string;
}

export interface SavedSessionPayload {
  session: unknown;
  runState?: unknown;
  artifacts: unknown;
  memory: unknown;
  preferences: unknown;
  vectorIndex: unknown;
}

export interface SaveSessionRequest {
  id?: string | undefined;
  name?: string | undefined;
  payload: SavedSessionPayload;
}

export interface SavedSessionRecord extends SavedSessionSummary {
  payload: SavedSessionPayload;
  verification: SavedSessionVerification;
}

export interface SessionStorePort {
  save(request: SaveSessionRequest): Promise<SavedSessionRecord>;
  list(): Promise<SavedSessionSummary[]>;
  load(id: string): Promise<SavedSessionRecord>;
  inspect(id: string): Promise<SavedSessionVerification>;
}
