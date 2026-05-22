import test from "node:test";
import assert from "node:assert/strict";
import { resolveRuntimeHostSelection } from "../../../src/application/project-config.js";
import { PurposeRoutingLanguageModel } from "../../../src/application/model-provider.js";
import type { AgentConfig, ProjectConfig } from "../../../src/application/project-config.js";
import type {
  LanguageModelPort,
  LanguageModelResponse,
} from "../../../src/ports/language-model-port.js";

class StubModel implements LanguageModelPort {
  async complete(): Promise<LanguageModelResponse> {
    return { content: "ok", toolCalls: [] };
  }
}

function buildAgent(): AgentConfig {
  return {
    tools: [],
    models: {
      depth: "small",
      classify: "small",
      decompose: "small",
      answer: "small",
      summarize: "small",
      synthesize: "small",
    },
  };
}

function buildProject(): ProjectConfig {
  return {
    models: {
      default: "model-a",
      tiers: {
        small: { name: "model-a", estimatedRamMb: 1024 },
      },
    },
    memory: {
      maxRamMb: "auto",
      reserveSystemRamMb: 0,
      waitForCapacity: false,
      capacityCheckIntervalMs: 1,
    },
    runtime: {
      maxDynamicDepth: 2,
      maxBranches: 2,
      maxPromptCharacters: 500,
      maxModelCalls: 6,
      maxToolRounds: 1,
    },
    agents: { default: buildAgent() },
    workflows: {},
    hosts: {
      local_ollama: { kind: "ollama", baseUrl: "http://127.0.0.1:11434", available: true },
      remote_http: { kind: "http", baseUrl: "https://example.com/v1/chat", available: true },
    },
    runtimeHost: "local_ollama",
  };
}

test("runtime host selection precedence follows env > cli > config > defaults", () => {
  const project = buildProject();
  const fromEnv = resolveRuntimeHostSelection(project, {
    cliHostId: "remote_http",
    env: { RLM_HOST: "local_ollama" } as NodeJS.ProcessEnv,
  });
  assert.equal(fromEnv.hostId, "local_ollama");
  assert.equal(fromEnv.source, "env");

  const fromCli = resolveRuntimeHostSelection(project, {
    cliHostId: "remote_http",
    env: {} as NodeJS.ProcessEnv,
  });
  assert.equal(fromCli.hostId, "remote_http");
  assert.equal(fromCli.source, "cli");

  const fromConfig = resolveRuntimeHostSelection(project, {
    env: {} as NodeJS.ProcessEnv,
  });
  assert.equal(fromConfig.hostId, "local_ollama");
  assert.equal(fromConfig.source, "config");
});

test("unavailable host can switch to an allowed host", async () => {
  const project = buildProject();
  project.hosts = {
    local_ollama: { kind: "ollama", baseUrl: "http://127.0.0.1:11434", available: false },
    remote_http: { kind: "http", baseUrl: "https://example.com/v1/chat", available: true },
  };
  const model = new PurposeRoutingLanguageModel({
    config: project,
    agent: buildAgent(),
    hostSelection: { hostId: "local_ollama", source: "config" },
    createModel: () => new StubModel(),
    resolveUnavailableHostDecision: async () => ({ action: "switch", hostId: "remote_http" }),
  });

  const selection = await model.selectModel("answer", 1);
  assert.equal(selection.hostId, "remote_http");
  assert.equal(selection.hostKind, "http");
});

test("unavailable host aborts when decision is abort", async () => {
  const project = buildProject();
  project.hosts = {
    local_ollama: { kind: "ollama", baseUrl: "http://127.0.0.1:11434", available: false },
  };
  const model = new PurposeRoutingLanguageModel({
    config: project,
    agent: buildAgent(),
    hostSelection: { hostId: "local_ollama", source: "config" },
    createModel: () => new StubModel(),
    resolveUnavailableHostDecision: async () => ({ action: "abort" }),
  });

  await assert.rejects(() => model.selectModel("answer", 1), /unavailable/i);
});
