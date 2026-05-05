import type { TracePort } from "../ports/trace-port.js";
import type { TraceEvent } from "../domain/types.js";

export class InMemoryTrace implements TracePort {
  private readonly entries: TraceEvent[] = [];

  record(event: TraceEvent): void {
    this.entries.push(event);
  }

  events(): TraceEvent[] {
    return [...this.entries];
  }
}
