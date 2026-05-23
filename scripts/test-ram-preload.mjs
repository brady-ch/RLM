/**
 * Node test preload — checks available RAM before every test case.
 * Usage: node --import ./scripts/test-ram-preload.mjs --test ...
 */
import { beforeEach } from "node:test";
import { requireRamGate } from "./lib/ram-gate.mjs";

beforeEach(() => {
  const ok = requireRamGate({ tier: "minimal", label: "node:test case" });
  if (!ok) {
    throw new Error("RAM gate blocked test execution — free memory and retry");
  }
});
