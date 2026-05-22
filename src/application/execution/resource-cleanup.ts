import type { RuntimeLogger } from "../../ports/runtime-logger-port.js";

export interface ClosableResource {
  close(): Promise<void>;
}

export class ResourceCleanup {
  private readonly resources = new Set<ClosableResource>();
  private closed = false;

  constructor(private readonly logger?: RuntimeLogger | undefined) {}

  track<T extends ClosableResource>(resource: T): T {
    if (!this.closed) {
      this.resources.add(resource);
    }

    return resource;
  }

  async closeAll(reason: string): Promise<void> {
    if (this.closed) {
      return;
    }

    this.closed = true;
    const resources = [...this.resources];
    this.resources.clear();
    this.logger?.log({
      stage: "shutdown",
      message: "closing resources",
      data: {
        reason,
        resources: resources.length,
      },
    });

    await Promise.all(
      resources.map(async (resource) => {
        try {
          await resource.close();
        } catch (error: unknown) {
          this.logger?.log({
            stage: "shutdown",
            message: "resource close failed",
            data: {
              error: error instanceof Error ? error.message : String(error),
            },
          });
        }
      }),
    );
  }
}
