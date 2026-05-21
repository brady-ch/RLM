import { mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import type {
  SavedSessionPayload,
  SavedSessionRecord,
  SavedSessionRestoreStatus,
  SavedSessionSectionStatus,
  SavedSessionSummary,
  SavedSessionVerification,
  SaveSessionRequest,
  SessionStorePort,
} from "../ports/session-store-port.js";

const MANIFEST_VERSION = 1;
const SECTION_VERSION = 1;

const SECTION_FILES = {
  session: "session.json",
  runState: "run-state.json",
  artifacts: "artifacts.json",
  memory: "memory.json",
  preferences: "preferences.json",
  vectorIndex: "vector-index.json",
} as const;

type SectionName = keyof typeof SECTION_FILES;

interface SectionManifest {
  file: string;
  version: number;
}

interface SavedSessionManifest {
  version: number;
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  sections: Record<SectionName, SectionManifest>;
}

interface SectionEnvelope {
  version: number;
  data: unknown;
}

export class FileSessionStore implements SessionStorePort {
  private readonly baseDir: string;
  private readonly now: () => string;
  private writeCounter = 0;

  constructor(options: { baseDir: string; now?: () => string }) {
    this.baseDir = resolve(options.baseDir);
    this.now = options.now ?? (() => new Date().toISOString());
  }

  async save(request: SaveSessionRequest): Promise<SavedSessionRecord> {
    const id = sanitizeSessionId(request.id ?? `session-${Date.now()}`);
    const dir = this.sessionDir(id);
    await mkdir(dir, { recursive: true });
    const existing = await this.readManifest(id).catch(() => undefined);
    const timestamp = this.now();
    const manifest: SavedSessionManifest = {
      version: MANIFEST_VERSION,
      id,
      name: request.name?.trim() || existing?.name || id,
      createdAt: existing?.createdAt ?? timestamp,
      updatedAt: timestamp,
      sections: {
        session: { file: SECTION_FILES.session, version: SECTION_VERSION },
        runState: { file: SECTION_FILES.runState, version: SECTION_VERSION },
        artifacts: { file: SECTION_FILES.artifacts, version: SECTION_VERSION },
        memory: { file: SECTION_FILES.memory, version: SECTION_VERSION },
        preferences: { file: SECTION_FILES.preferences, version: SECTION_VERSION },
        vectorIndex: { file: SECTION_FILES.vectorIndex, version: SECTION_VERSION },
      },
    };

    await this.writeJson(join(dir, SECTION_FILES.session), envelope(request.payload.session));
    await this.writeJson(join(dir, SECTION_FILES.runState), envelope(request.payload.runState ?? null));
    await this.writeJson(join(dir, SECTION_FILES.artifacts), envelope(request.payload.artifacts));
    await this.writeJson(join(dir, SECTION_FILES.memory), envelope(request.payload.memory));
    await this.writeJson(join(dir, SECTION_FILES.preferences), envelope(request.payload.preferences));
    await this.writeJson(join(dir, SECTION_FILES.vectorIndex), envelope(request.payload.vectorIndex));
    await this.writeJson(join(dir, "manifest.json"), manifest);

    return this.load(id);
  }

  async list(): Promise<SavedSessionSummary[]> {
    let entries: string[] = [];
    try {
      entries = await readdir(this.baseDir);
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return [];
      }
      throw error;
    }
    const summaries: SavedSessionSummary[] = [];
    for (const entry of entries) {
      try {
        const manifest = await this.readManifest(entry);
        const verification = await this.verifyManifest(manifest);
        summaries.push({
          id: manifest.id,
          name: manifest.name,
          createdAt: manifest.createdAt,
          updatedAt: manifest.updatedAt,
          status: verification.status,
          path: this.sessionDir(manifest.id),
        });
      } catch {
        continue;
      }
    }
    return summaries.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async load(id: string): Promise<SavedSessionRecord> {
    const manifest = await this.readManifest(id);
    const verification = await this.verifyManifest(manifest);
    const payload: SavedSessionPayload = {
      session: await this.readSection(manifest, "session"),
      runState: await this.readSection(manifest, "runState"),
      artifacts: await this.readSection(manifest, "artifacts"),
      memory: await this.readSection(manifest, "memory"),
      preferences: await this.readSection(manifest, "preferences"),
      vectorIndex: await this.readSection(manifest, "vectorIndex"),
    };
    return {
      id: manifest.id,
      name: manifest.name,
      createdAt: manifest.createdAt,
      updatedAt: manifest.updatedAt,
      status: verification.status,
      path: this.sessionDir(manifest.id),
      payload,
      verification,
    };
  }

  async inspect(id: string): Promise<SavedSessionVerification> {
    return this.verifyManifest(await this.readManifest(id));
  }

  private async verifyManifest(manifest: SavedSessionManifest): Promise<SavedSessionVerification> {
    const sections: SavedSessionSectionStatus[] = [];
    const missing: string[] = [];
    const corrupt: Array<{ section: string; reason: string }> = [];

    if (manifest.version !== MANIFEST_VERSION) {
      corrupt.push({ section: "manifest", reason: `unsupported manifest version ${manifest.version}` });
    }

    for (const name of Object.keys(SECTION_FILES) as SectionName[]) {
      const section = manifest.sections[name];
      if (!section) {
        missing.push(name);
        sections.push({ name, status: "failed", path: "", reason: "missing manifest section" });
        continue;
      }
      const path = join(this.sessionDir(manifest.id), section.file);
      try {
        const raw = await readFile(path, "utf8");
        const parsed = JSON.parse(raw) as SectionEnvelope;
        if (parsed.version !== section.version) {
          corrupt.push({ section: name, reason: `unsupported section version ${parsed.version}` });
          sections.push({ name, status: "failed", path, version: parsed.version, reason: "unsupported section version" });
          continue;
        }
        sections.push({ name, status: "complete", path, version: parsed.version });
      } catch (error: unknown) {
        const code = (error as NodeJS.ErrnoException).code;
        if (code === "ENOENT") {
          missing.push(name);
          sections.push({ name, status: "failed", path, reason: "missing section file" });
        } else {
          const reason = error instanceof Error ? error.message : String(error);
          corrupt.push({ section: name, reason });
          sections.push({ name, status: "failed", path, reason });
        }
      }
    }

    const status = restoreStatus(missing.length, corrupt.length);
    return {
      status,
      sections: sections.map((section) => section.status === "failed" && status === "degraded" ? { ...section, status: "degraded" } : section),
      missing,
      corrupt,
      unsafeToContinue: status !== "complete",
    };
  }

  private async readSection(manifest: SavedSessionManifest, name: SectionName): Promise<unknown> {
    const section = manifest.sections[name];
    if (!section) {
      return null;
    }
    const raw = await readFile(join(this.sessionDir(manifest.id), section.file), "utf8");
    const parsed = JSON.parse(raw) as SectionEnvelope;
    return parsed.data;
  }

  private async readManifest(id: string): Promise<SavedSessionManifest> {
    const raw = await readFile(join(this.sessionDir(sanitizeSessionId(id)), "manifest.json"), "utf8");
    return JSON.parse(raw) as SavedSessionManifest;
  }

  private async writeJson(path: string, value: unknown): Promise<void> {
    await mkdir(dirname(path), { recursive: true });
    const tempPath = `${path}.${process.pid}.${this.writeCounter += 1}.tmp`;
    await writeFile(tempPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
    await rename(tempPath, path);
  }

  private sessionDir(id: string): string {
    return join(this.baseDir, sanitizeSessionId(id));
  }
}

function envelope(data: unknown): SectionEnvelope {
  return { version: SECTION_VERSION, data };
}

function restoreStatus(missingCount: number, corruptCount: number): SavedSessionRestoreStatus {
  if (corruptCount > 0) {
    return "failed";
  }
  if (missingCount > 0) {
    return "degraded";
  }
  return "complete";
}

function sanitizeSessionId(id: string): string {
  const safe = id.trim().replace(/[^a-zA-Z0-9._-]/g, "-").replace(/-+/g, "-");
  if (!safe || safe === "." || safe === "..") {
    throw new Error("Session id must contain at least one safe character.");
  }
  return safe;
}
