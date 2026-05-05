import type { TraceEvent } from "../domain/types.js";

export interface TracePort {
  record(event: TraceEvent): void;
  events(): TraceEvent[];
}
