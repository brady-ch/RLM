import type { RuntimeLogger } from "../ports/runtime-logger-port.js";

export interface ShutdownController {
  markCompleted(): void;
}

export function installShutdownHandlers(input: {
  cleanup: (reason: string) => Promise<void>;
  json: boolean;
  logger?: RuntimeLogger | undefined;
}): ShutdownController {
  let completed = false;
  let shuttingDown = false;

  const shutdown = async (reason: string, exitCode: number): Promise<void> => {
    if (completed || shuttingDown) {
      return;
    }

    shuttingDown = true;
    input.logger?.log({
      stage: "shutdown",
      message: "shutdown requested",
      data: {
        reason,
        exitCode,
      },
    });

    await input.cleanup(reason);
    if (input.json) {
      console.error(JSON.stringify({ error: `Interrupted by ${reason}` }));
    } else {
      console.error(`RLM interrupted by ${reason}; resources released.`);
    }
    process.exit(exitCode);
  };

  process.once("SIGINT", () => {
    void shutdown("SIGINT", 130);
  });
  process.once("SIGTERM", () => {
    void shutdown("SIGTERM", 143);
  });

  return {
    markCompleted(): void {
      completed = true;
    },
  };
}
