/** Public adapter barrel — prefer this import path outside adapter implementation files. */

export type { SearchQueryArgs } from "./tools/search-query.js";
export { buildSearchQuery } from "./tools/search-query.js";
export { GuardedShellTool } from "./tools/guarded-shell-tool.js";
export { WebFetchTool } from "./tools/web-fetch-tool.js";
export { WebSearchTool, parseUddgLines } from "./tools/web-search-tool.js";
export { WorkspaceFileWriteTool } from "./tools/workspace-file-write-tool.js";

export { FileMemoryStore } from "./persistence/file-memory-store.js";
export { FileRunStateStore } from "./persistence/file-run-state-store.js";
export { FileSessionStore } from "./persistence/file-session-store.js";
export { FileVectorIndex } from "./persistence/file-vector-index.js";
export type { VectorIndexRecord } from "./persistence/file-vector-index.js";
export { InMemoryTrace } from "./persistence/in-memory-trace.js";

export { HttpLanguageModelAdapter } from "./models/http-language-model.js";
export { OllamaEmbeddingModel } from "./models/ollama-embedding-model.js";
export { OllamaLanguageModelAdapter } from "./models/ollama-language-model.js";
