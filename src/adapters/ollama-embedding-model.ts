import type { EmbeddingPort } from "../ports/embedding-port.js";

export class OllamaEmbeddingModel implements EmbeddingPort {
  private readonly baseUrl: string;
  private readonly model: string;

  constructor(options: { baseUrl?: string; model?: string }) {
    this.baseUrl = options.baseUrl ?? "http://127.0.0.1:11434";
    this.model = options.model ?? "nomic-embed-text";
  }

  async embed(input: string): Promise<number[]> {
    const response = await fetch(new URL("/api/embeddings", this.baseUrl), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ model: this.model, prompt: input }),
    });
    if (!response.ok) {
      throw new Error(`Ollama embeddings failed: HTTP ${response.status}`);
    }
    const payload = await response.json() as { embedding?: number[] };
    if (!Array.isArray(payload.embedding)) {
      throw new Error("Ollama embeddings response did not include an embedding.");
    }
    return payload.embedding;
  }
}
