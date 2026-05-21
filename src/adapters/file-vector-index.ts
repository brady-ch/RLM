import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

export interface VectorIndexRecord {
  id: string;
  sessionId: string;
  scopeId: string;
  source: "scope" | "episodic" | "artifact";
  text: string;
  embedding: number[];
  updatedAt: string;
}

export class FileVectorIndex {
  private readonly path: string;
  private writeCounter = 0;

  constructor(options: { path: string }) {
    this.path = resolve(options.path);
  }

  async read(): Promise<VectorIndexRecord[]> {
    try {
      return JSON.parse(await readFile(this.path, "utf8")) as VectorIndexRecord[];
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return [];
      }
      throw error;
    }
  }

  async replace(records: VectorIndexRecord[]): Promise<void> {
    await mkdir(dirname(this.path), { recursive: true });
    const temp = `${this.path}.${process.pid}.${this.writeCounter += 1}.tmp`;
    await writeFile(temp, `${JSON.stringify(records, null, 2)}\n`, "utf8");
    await rename(temp, this.path);
  }
}
