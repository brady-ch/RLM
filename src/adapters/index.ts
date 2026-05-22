/** Public adapter barrel — prefer this import path outside adapter implementation files. */

export type { SearchQueryArgs } from "../plugins/builtin/web/search-query.js";
export { buildSearchQuery } from "../plugins/builtin/web/search-query.js";
export {
  analyzeHtmlContent,
  stripFluffWords,
  stripHtmlTags,
} from "../plugins/builtin/web/content-tree.js";
export type { ContentTreeNode, ContentTreeResult } from "../plugins/builtin/web/content-tree.js";
export { GuardedShellTool } from "../plugins/builtin/shell/guarded-shell-tool.js";
export { WebFetchTool } from "../plugins/builtin/web/web-fetch-tool.js";
export { WebSearchTool, parseUddgLines } from "../plugins/builtin/web/web-search-tool.js";
export { WorkspaceFileWriteTool } from "../plugins/builtin/files/workspace-file-write-tool.js";

export { FileMemoryStore } from "./persistence/file-memory-store.js";
export { FileRunStateStore } from "./persistence/file-run-state-store.js";
export { FileSessionStore } from "./persistence/file-session-store.js";
export { FileVectorIndex } from "./persistence/file-vector-index.js";
export type { VectorIndexRecord } from "./persistence/file-vector-index.js";
export { InMemoryTrace } from "./persistence/in-memory-trace.js";

export { HttpLanguageModelAdapter } from "./models/http-language-model.js";
export { OllamaEmbeddingModel } from "./models/ollama-embedding-model.js";
export { OllamaLanguageModelAdapter } from "./models/ollama-language-model.js";
