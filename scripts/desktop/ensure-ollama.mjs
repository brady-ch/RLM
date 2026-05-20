#!/usr/bin/env node
import { spawn } from "node:child_process";

const baseUrl = process.env.OLLAMA_HOST ?? "http://127.0.0.1:11434";
const manage = process.env.RLM_MANAGE_OLLAMA === "1";

if (await isOllamaReady(baseUrl)) {
  console.error(`[rlm desktop] Ollama ready at ${baseUrl}`);
  process.exit(0);
}

if (!manage) {
  console.error(`[rlm desktop] Ollama unavailable at ${baseUrl}. Set RLM_MANAGE_OLLAMA=1 to start 'ollama serve'.`);
  process.exit(2);
}

const child = spawn("ollama", ["serve"], {
  detached: true,
  stdio: "ignore",
});
child.unref();

for (let attempt = 0; attempt < 30; attempt += 1) {
  await new Promise((resolve) => setTimeout(resolve, 500));
  if (await isOllamaReady(baseUrl)) {
    console.error(`[rlm desktop] Ollama started at ${baseUrl}`);
    process.exit(0);
  }
}

console.error(`[rlm desktop] Ollama did not become ready at ${baseUrl}`);
process.exit(2);

async function isOllamaReady(url) {
  try {
    const response = await fetch(new URL("/api/version", url), { signal: AbortSignal.timeout(1000) });
    return response.ok;
  } catch {
    return false;
  }
}
