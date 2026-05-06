import type { RuntimeLogEvent, RuntimeLogger } from "../ports/runtime-logger-port.js";

export function createStderrRuntimeLogger(): RuntimeLogger {
  const startedAt = Date.now();

  return {
    log(event: RuntimeLogEvent): void {
      const elapsedMs = Date.now() - startedAt;
      const suffix = event.data && Object.keys(event.data).length > 0
        ? ` ${JSON.stringify(event.data)}`
        : "";
      console.error(`[rlm +${elapsedMs}ms] ${event.stage}: ${event.message}${suffix}`);
    },
  };
}
