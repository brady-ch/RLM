import { createHash, randomUUID } from "node:crypto";

export type RuntimeEventSeverity = "info" | "warn" | "error";

export interface RuntimeEvent {
  eventId: string;
  fingerprint: string;
  runId: string;
  code: string;
  severity: RuntimeEventSeverity;
  source: string;
  subject: string;
  occurredAt: string;
  seq: number;
  message: string;
  metrics?: Record<string, unknown> | undefined;
}

export interface RuntimeEventInput {
  runId: string;
  code: string;
  severity: RuntimeEventSeverity;
  source: string;
  subject: string;
  occurredAt: string;
  seq: number;
  message: string;
  metrics?: Record<string, unknown> | undefined;
}

export function createRuntimeEvent(input: RuntimeEventInput): RuntimeEvent {
  return {
    eventId: randomUUID(),
    fingerprint: createRuntimeEventFingerprint(input),
    runId: input.runId,
    code: input.code,
    severity: input.severity,
    source: input.source,
    subject: input.subject,
    occurredAt: input.occurredAt,
    seq: input.seq,
    message: input.message,
    metrics: input.metrics,
  };
}

export function createRuntimeEventFingerprint(input: Omit<RuntimeEventInput, "message" | "metrics">): string {
  const base = `${input.runId}|${input.occurredAt}|${input.code}|${input.source}|${input.subject}|${input.seq}`;
  return createHash("sha256").update(base).digest("hex");
}
