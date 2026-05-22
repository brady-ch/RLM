import { appendFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import type {
  InteropConfig,
  McpServerConfig,
  SkillPathPolicyConfig,
} from "../../application/project-config.js";
import {
  createRuntimeEvent,
  type RuntimeEvent,
  type RuntimeEventSeverity,
} from "../../application/runtime-events.js";

export interface SequenceAllocator {
  nextSeq(runId: string): Promise<number>;
}

export interface EventStore {
  append(event: RuntimeEvent): Promise<void>;
}

export interface RuntimeEventSink {
  emit(event: RuntimeEvent): Promise<void>;
}

export interface SkillCandidate {
  name: string;
  absolutePath: string;
  valid: boolean;
  reason?: string | undefined;
}

export interface ResolvedSkill {
  candidate: SkillCandidate;
  warnings: RuntimeEvent[];
}

interface McpState {
  config: McpServerConfig;
  connected: boolean;
  pausedAtMs?: number | undefined;
  escalatedSeverity?: RuntimeEventSeverity | undefined;
  blockedEvents: number;
  pauseReason?: string | undefined;
}

const WARN_THRESHOLD_MS = 10_000;
const ERROR_THRESHOLD_MS = 60_000;

export class CentralAtomicSequenceAllocator implements SequenceAllocator {
  private readonly counters = new Map<string, number>();
  private unavailable = false;

  setUnavailable(value: boolean): void {
    this.unavailable = value;
  }

  async nextSeq(runId: string): Promise<number> {
    if (this.unavailable) {
      throw new Error("STATE_STORE_UNAVAILABLE");
    }
    const next = (this.counters.get(runId) ?? 0) + 1;
    this.counters.set(runId, next);
    return next;
  }
}

export class InMemoryEventStore implements EventStore {
  readonly events: RuntimeEvent[] = [];

  async append(event: RuntimeEvent): Promise<void> {
    this.events.push(event);
  }
}

export class FileEventExportSink implements RuntimeEventSink {
  constructor(private readonly outputPath: string) {}

  async emit(event: RuntimeEvent): Promise<void> {
    const resolved = resolve(this.outputPath);
    await mkdir(dirname(resolved), { recursive: true });
    await appendFile(resolved, `${JSON.stringify(event)}\n`, "utf8");
  }
}

export class CompositeEventSink implements RuntimeEventSink {
  constructor(private readonly sinks: RuntimeEventSink[]) {}

  async emit(event: RuntimeEvent): Promise<void> {
    for (const sink of this.sinks) {
      await sink.emit(event);
    }
  }
}

export class EventStoreSink implements RuntimeEventSink {
  constructor(private readonly store: EventStore) {}

  async emit(event: RuntimeEvent): Promise<void> {
    await this.store.append(event);
  }
}

export class McpSkillRuntime {
  private readonly mcp = new Map<string, McpState>();

  constructor(
    private readonly config: InteropConfig,
    private readonly runId: string,
    private readonly sequence: SequenceAllocator,
    private readonly sink: RuntimeEventSink,
    private readonly now: () => number = () => Date.now(),
  ) {
    for (const server of config.mcp.servers) {
      this.mcp.set(server.id, {
        config: server,
        connected: true,
        blockedEvents: 0,
      });
    }
  }

  getSkillSearchPaths(): string[] {
    return this.config.skills.searchPaths;
  }

  isSkillCacheEnabled(): boolean {
    return this.config.skills.cache;
  }

  async resolveSkill(
    name: string,
    candidates: SkillCandidate[],
  ): Promise<ResolvedSkill | undefined> {
    const warnings: RuntimeEvent[] = [];
    const ordered = orderCandidatesByPath(candidates, this.getSkillSearchPaths());
    for (const candidate of ordered) {
      if (candidate.name !== name) {
        continue;
      }

      const strictness = this.strictnessForPath(candidate.absolutePath);
      if (!candidate.valid) {
        const event = await this.emitLifecycle({
          code: "SKILL_PARSE_ERROR",
          source: "skills",
          subject: candidate.absolutePath,
          severity: strictness === "strict" ? "error" : "warn",
          message: candidate.reason ?? `Invalid skill candidate for ${name}`,
        });

        warnings.push(event);
        if (strictness === "strict") {
          throw new Error(
            `Skill parse error at ${candidate.absolutePath}: ${candidate.reason ?? "unknown"}`,
          );
        }
        continue;
      }

      return { candidate, warnings };
    }
    return undefined;
  }

  async markDisconnected(
    serverId: string,
    reason: string,
    affectedNodes: Array<{ id: string; type: string; model: string }>,
    pendingCheckpointCount: number,
  ): Promise<void> {
    const state = this.getServerState(serverId);
    state.connected = false;
    state.pauseReason = reason;
    state.pausedAtMs = this.now();
    state.blockedEvents = 0;
    state.escalatedSeverity = "info";

    await this.emitLifecycle({
      code: state.config.required ? "MCP_REQUIRED_DISCONNECT" : "MCP_OPTIONAL_DISCONNECT",
      source: "mcp",
      subject: state.config.id,
      severity: "info",
      message: `MCP server disconnected: ${state.config.id}`,
      metrics: this.outageMetrics(state, affectedNodes, pendingCheckpointCount),
    });
  }

  async tickOutage(
    serverId: string,
    affectedNodes: Array<{ id: string; type: string; model: string }>,
    pendingCheckpointCount: number,
  ): Promise<void> {
    const state = this.getServerState(serverId);
    if (state.connected || state.pausedAtMs === undefined) {
      return;
    }

    state.blockedEvents += 1;
    const duration = this.now() - state.pausedAtMs;
    const nextSeverity =
      duration >= ERROR_THRESHOLD_MS ? "error" : duration >= WARN_THRESHOLD_MS ? "warn" : "info";
    if (nextSeverity === state.escalatedSeverity || nextSeverity === "info") {
      return;
    }

    state.escalatedSeverity = nextSeverity;
    await this.emitLifecycle({
      code: nextSeverity === "warn" ? "MCP_OUTAGE_WARN" : "MCP_OUTAGE_ERROR",
      source: "mcp",
      subject: state.config.id,
      severity: nextSeverity,
      message: `MCP outage escalated to ${nextSeverity}: ${state.config.id}`,
      metrics: this.outageMetrics(state, affectedNodes, pendingCheckpointCount),
    });
  }

  async markReconnected(
    serverId: string,
    affectedNodes: Array<{ id: string; type: string; model: string }>,
    pendingCheckpointCount: number,
  ): Promise<void> {
    const state = this.getServerState(serverId);
    if (state.pausedAtMs === undefined) {
      state.connected = true;
      return;
    }

    const duration = this.now() - state.pausedAtMs;
    const metrics = {
      outage_duration_ms: duration,
      events_blocked_count: state.blockedEvents,
      resume_seq: await this.peekNextSeq(),
      affected_nodes: affectedNodes,
      pending_checkpoint_count: pendingCheckpointCount,
    };

    state.connected = true;
    state.pausedAtMs = undefined;
    state.pauseReason = undefined;
    state.escalatedSeverity = undefined;
    state.blockedEvents = 0;

    await this.emitLifecycle({
      code: "MCP_RECOVERED",
      source: "mcp",
      subject: state.config.id,
      severity: "info",
      message: `MCP server reconnected: ${state.config.id}`,
      metrics,
    });
  }

  shouldPauseForServer(serverId: string): boolean {
    const state = this.getServerState(serverId);
    return !state.connected;
  }

  serverRequired(serverId: string): boolean {
    return this.getServerState(serverId).config.required;
  }

  private strictnessForPath(path: string): "strict" | "lenient" {
    const policies: SkillPathPolicyConfig[] = this.config.skills.pathPolicies;
    for (const policy of policies) {
      if (path.startsWith(resolve(policy.path))) {
        return policy.strictness;
      }
    }
    return "strict";
  }

  private getServerState(serverId: string): McpState {
    const state = this.mcp.get(serverId);
    if (!state) {
      throw new Error(`Unknown MCP server: ${serverId}`);
    }
    return state;
  }

  private outageMetrics(
    state: McpState,
    affectedNodes: Array<{ id: string; type: string; model: string }>,
    pendingCheckpointCount: number,
  ): Record<string, unknown> {
    const outageDuration = state.pausedAtMs === undefined ? 0 : this.now() - state.pausedAtMs;
    return {
      outage_duration_ms: outageDuration,
      events_blocked_count: state.blockedEvents,
      current_pause_reason: state.pauseReason ?? "",
      last_successful_seq: null,
      affected_nodes: affectedNodes,
      pending_checkpoint_count: pendingCheckpointCount,
    };
  }

  private async emitLifecycle(input: {
    code: string;
    source: string;
    subject: string;
    severity: RuntimeEventSeverity;
    message: string;
    metrics?: Record<string, unknown>;
  }): Promise<RuntimeEvent> {
    const seq = await this.sequence.nextSeq(this.runId);
    const event = createRuntimeEvent({
      runId: this.runId,
      code: input.code,
      severity: input.severity,
      source: input.source,
      subject: input.subject,
      occurredAt: new Date(this.now()).toISOString(),
      seq,
      message: input.message,
      metrics: input.metrics,
    });
    await this.sink.emit(event);
    return event;
  }

  private async peekNextSeq(): Promise<number> {
    const seq = await this.sequence.nextSeq(this.runId);
    return seq;
  }
}

function orderCandidatesByPath(
  candidates: SkillCandidate[],
  searchPaths: string[],
): SkillCandidate[] {
  const ordered: SkillCandidate[] = [];
  for (const pathPrefix of searchPaths.map((path) => resolve(path))) {
    for (const candidate of candidates) {
      if (candidate.absolutePath.startsWith(pathPrefix)) {
        ordered.push(candidate);
      }
    }
  }
  for (const candidate of candidates) {
    if (!ordered.includes(candidate)) {
      ordered.push(candidate);
    }
  }
  return ordered;
}
