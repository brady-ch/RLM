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

export interface MutationAuditInput {
  runId: string;
  seq: number;
  actor: string;
  path: string;
  action: "set" | "delete";
  accepted: boolean;
  reason: string;
  occurredAt: string;
}

export function createMutationAuditEvent(input: MutationAuditInput): RuntimeEvent {
  const decision = input.accepted ? "accepted" : "rejected";
  return createRuntimeEvent({
    runId: input.runId,
    code: "RUN_STATE_MUTATION",
    severity: input.accepted ? "info" : "warn",
    source: "run-state",
    subject: `${input.actor}:${input.path}`,
    occurredAt: input.occurredAt,
    seq: input.seq,
    message: `${decision} ${input.action} on ${input.path}: ${input.reason}`,
    metrics: {
      actor: input.actor,
      path: input.path,
      action: input.action,
      accepted: input.accepted,
      reason: input.reason,
    },
  });
}
