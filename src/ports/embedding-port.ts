export interface EmbeddingPort {
  embed(input: string): Promise<number[]>;
}
