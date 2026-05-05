import { freemem, totalmem } from "node:os";
import type { ProjectConfig } from "./project-config.js";

export interface MemorySnapshot {
  totalRamMb: number;
  freeRamMb: number;
  usableRamMb: number;
  reservedRamMb: number;
  availableRamMb: number;
}

export interface MemoryReservation {
  requestedRamMb: number;
  snapshot: MemorySnapshot;
  release(): void;
}

export interface MemoryManagerOptions {
  config: ProjectConfig["memory"];
  freememBytes?: () => number;
  totalmemBytes?: () => number;
  sleep?: (ms: number) => Promise<void>;
}

export class MemoryManager {
  private reservedRamMb = 0;
  private readonly freememBytes: () => number;
  private readonly totalmemBytes: () => number;
  private readonly sleep: (ms: number) => Promise<void>;

  constructor(private readonly options: MemoryManagerOptions) {
    this.freememBytes = options.freememBytes ?? freemem;
    this.totalmemBytes = options.totalmemBytes ?? totalmem;
    this.sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  }

  snapshot(): MemorySnapshot {
    const totalRamMb = bytesToMb(this.totalmemBytes());
    const freeRamMb = bytesToMb(this.freememBytes());
    const maxRamMb = this.options.config.maxRamMb === "auto"
      ? Math.max(0, freeRamMb - this.options.config.reserveSystemRamMb)
      : this.options.config.maxRamMb;
    const usableRamMb = Math.max(0, maxRamMb);
    const availableRamMb = Math.max(0, usableRamMb - this.reservedRamMb);

    return {
      totalRamMb,
      freeRamMb,
      usableRamMb,
      reservedRamMb: this.reservedRamMb,
      availableRamMb,
    };
  }

  async reserve(requestedRamMb: number): Promise<MemoryReservation> {
    while (true) {
      const snapshot = this.snapshot();
      if (requestedRamMb <= snapshot.availableRamMb) {
        this.reservedRamMb += requestedRamMb;
        return {
          requestedRamMb,
          snapshot,
          release: () => {
            this.reservedRamMb = Math.max(0, this.reservedRamMb - requestedRamMb);
          },
        };
      }

      if (!this.options.config.waitForCapacity) {
        throw new Error(
          `Insufficient RAM for agent reservation: requested ${requestedRamMb} MB, available ${snapshot.availableRamMb} MB.`,
        );
      }

      await this.sleep(this.options.config.capacityCheckIntervalMs);
    }
  }
}

function bytesToMb(value: number): number {
  return Math.floor(value / 1024 / 1024);
}
