import type { ProjectConfig } from "./project-config.js";

export type ModelLibraryEntry = {
  id: string;
  label: string;
  source: "curated" | "huggingface" | "installed";
  ollamaModel?: string | undefined;
  description: string;
  tags: string[];
  estimatedRamMb?: number | undefined;
  status: "available" | "installed" | "installing" | "failed" | "unsupported";
  reason?: string | undefined;
};

export type ModelInstallJob = {
  id: string;
  model: string;
  status: "queued" | "running" | "ready" | "failed";
  progress: number;
  message: string;
  startedAt: string;
  completedAt?: string | undefined;
};

export interface ModelLibrarySnapshot {
  curated: ModelLibraryEntry[];
  installed: ModelLibraryEntry[];
  jobs: ModelInstallJob[];
  tiers: Record<string, string>;
}

export interface ModelLibrarySearchResult {
  query: string;
  results: ModelLibraryEntry[];
}

const CURATED_MODELS: ModelLibraryEntry[] = [
  {
    id: "granite4.1:3b",
    label: "Granite 4.1 3B",
    source: "curated",
    ollamaModel: "granite4.1:3b",
    description: "Small default model for routing, classification, and quick local answers.",
    tags: ["small", "default", "routing"],
    estimatedRamMb: 4096,
    status: "available",
  },
  {
    id: "llama3.1:8b",
    label: "Llama 3.1 8B",
    source: "curated",
    ollamaModel: "llama3.1:8b",
    description: "Balanced general-purpose local model for answer and synthesis work.",
    tags: ["balanced", "general", "synthesis"],
    estimatedRamMb: 8192,
    status: "available",
  },
  {
    id: "qwen2.5-coder:14b",
    label: "Qwen2.5 Coder 14B",
    source: "curated",
    ollamaModel: "qwen2.5-coder:14b",
    description: "Larger coding-oriented model for complex implementation and review tasks.",
    tags: ["large", "coding", "review"],
    estimatedRamMb: 16000,
    status: "available",
  },
];

export class ModelLibraryService {
  private readonly jobs = new Map<string, ModelInstallJob>();

  constructor(
    private readonly input: {
      config: ProjectConfig;
      ollamaBaseUrl: string;
      fetch?: typeof fetch | undefined;
    },
  ) {}

  async snapshot(): Promise<ModelLibrarySnapshot> {
    const installed = await this.listInstalled();
    const installedIds = new Set(installed.map((entry) => entry.id));
    const activeJobs = new Map([...this.jobs.values()].map((job) => [job.model, job]));
    return {
      curated: CURATED_MODELS.map((entry) => {
        const job = activeJobs.get(entry.ollamaModel ?? entry.id);
        return {
          ...entry,
          status: installedIds.has(entry.ollamaModel ?? entry.id)
            ? "installed"
            : job?.status === "failed"
              ? "failed"
              : job?.status === "queued" || job?.status === "running"
                ? "installing"
                : "available",
          reason: job?.status === "failed" ? job.message : entry.reason,
        };
      }),
      installed,
      jobs: [...this.jobs.values()],
      tiers: Object.fromEntries(Object.entries(this.input.config.models.tiers).map(([tier, model]) => [tier, model.name])),
    };
  }

  async searchHuggingFace(query: string): Promise<ModelLibrarySearchResult> {
    const normalized = query.trim();
    if (!normalized) {
      return { query: normalized, results: [] };
    }
    const url = new URL("/api/models", "https://huggingface.co");
    url.searchParams.set("search", normalized);
    url.searchParams.set("limit", "10");
    const response = await this.fetch(url);
    if (!response.ok) {
      throw new Error(`Hugging Face search failed: HTTP ${response.status}`);
    }
    const payload = await response.json() as Array<{ id?: string; modelId?: string; tags?: string[]; downloads?: number }>;
    return {
      query: normalized,
      results: payload.map((item) => {
        const id = item.modelId ?? item.id ?? "unknown";
        const tags = item.tags ?? [];
        const ggufCompatible = tags.some((tag) => tag.toLowerCase().includes("gguf"));
        return {
          id,
          label: id,
          source: "huggingface",
          description: ggufCompatible
            ? "Hugging Face GGUF-compatible result. Import flow is deferred until the desktop installer/model library can map it to Ollama."
            : "Unsupported for v1 direct install; Phase 22 only installs curated Ollama models.",
          tags,
          status: ggufCompatible ? "unsupported" : "unsupported",
          reason: ggufCompatible ? "GGUF import requires a follow-up mapping step." : "No compatible GGUF signal found.",
        };
      }),
    };
  }

  startInstall(model: string): ModelInstallJob {
    const normalized = model.trim();
    if (!normalized) {
      throw new Error("Model id is required.");
    }
    const allowed = new Set(CURATED_MODELS.map((entry) => entry.ollamaModel ?? entry.id));
    if (!allowed.has(normalized)) {
      throw new Error(`Model "${normalized}" is not a curated Ollama model.`);
    }
    const existing = [...this.jobs.values()].find((job) => job.model === normalized && (job.status === "queued" || job.status === "running"));
    if (existing) {
      return existing;
    }
    const job: ModelInstallJob = {
      id: `install-${Date.now()}-${this.jobs.size + 1}`,
      model: normalized,
      status: "queued",
      progress: 0,
      message: "queued",
      startedAt: new Date().toISOString(),
    };
    this.jobs.set(job.id, job);
    void this.runInstall(job);
    return job;
  }

  selectTier(input: { tier: string; model: string }): Record<string, string> {
    const tier = input.tier.trim();
    const model = input.model.trim();
    const existing = this.input.config.models.tiers[tier];
    if (!existing) {
      throw new Error(`Unknown model tier "${tier}".`);
    }
    if (!model) {
      throw new Error("Model id is required.");
    }
    this.input.config.models.tiers[tier] = {
      ...existing,
      name: model,
    };
    if (tier === "small") {
      this.input.config.models.default = model;
    }
    return Object.fromEntries(Object.entries(this.input.config.models.tiers).map(([key, value]) => [key, value.name]));
  }

  private async listInstalled(): Promise<ModelLibraryEntry[]> {
    try {
      const response = await this.fetch(new URL("/api/tags", this.input.ollamaBaseUrl));
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const payload = await response.json() as { models?: Array<{ name?: string; size?: number }> };
      return (payload.models ?? []).flatMap((item) => {
        const name = item.name?.trim();
        if (!name) {
          return [];
        }
        return [{
          id: name,
          label: name,
          source: "installed" as const,
          ollamaModel: name,
          description: "Installed Ollama model.",
          tags: ["installed"],
          status: "installed" as const,
        }];
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return [{
        id: "ollama-unavailable",
        label: "Ollama unavailable",
        source: "installed",
        description: "Installed model list could not be loaded.",
        tags: ["error"],
        status: "failed",
        reason: message,
      }];
    }
  }

  private async runInstall(job: ModelInstallJob): Promise<void> {
    job.status = "running";
    job.message = "pulling model";
    try {
      const response = await this.fetch(new URL("/api/pull", this.input.ollamaBaseUrl), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: job.model, stream: false }),
      });
      if (!response.ok) {
        throw new Error(`Ollama pull failed: HTTP ${response.status}`);
      }
      job.status = "ready";
      job.progress = 1;
      job.message = "ready";
      job.completedAt = new Date().toISOString();
    } catch (error: unknown) {
      job.status = "failed";
      job.progress = 0;
      job.message = error instanceof Error ? error.message : String(error);
      job.completedAt = new Date().toISOString();
    }
  }

  private fetch(input: URL, init?: RequestInit): Promise<Response> {
    return (this.input.fetch ?? fetch)(input, init);
  }
}
