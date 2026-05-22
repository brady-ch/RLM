import type { RuntimeLogEvent, RuntimeLogger } from "../../src/ports/runtime-logger-port.js";
import type { ToolExecutionResult, ToolPort } from "../../src/ports/tool-port.js";

export class CaptureLogger implements RuntimeLogger {
  readonly events: RuntimeLogEvent[] = [];

  log(event: RuntimeLogEvent): void {
    this.events.push(event);
  }
}

export class EchoTool implements ToolPort {
  readonly name = "echo";
  readonly description = "Echo input text.";
  readonly schema = {};

  async execute(args: Record<string, unknown>): Promise<ToolExecutionResult> {
    return {
      status: "success",
      output: `echo: ${String(args["text"] ?? "")}`,
    };
  }
}
