/**
 * Concrete adapters at the bootstrap boundary (stores, run state, vector index, embeddings).
 * Callers construct the runtime pipeline without deep-linking adapter subtrees (ADPT-06).
 */

export type { VectorIndexRecord } from "../../adapters/index.js";
export {
  FileMemoryStore,
  FileRunStateStore,
  FileSessionStore,
  FileVectorIndex,
  OllamaEmbeddingModel,
} from "../../adapters/index.js";
