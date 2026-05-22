import { access, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import {
  parseGraphWorkflowSidecar,
  exportSessionGraphToSidecar,
} from "./graph-workflow-serializer.js";
import type { GraphWorkflowConfig } from "./project-config.js";
import type {
  GraphWorkflowExportInput,
  GraphWorkflowListEntry,
  GraphWorkflowSidecar,
  GraphWorkflowVariant,
} from "./graph-workflow-types.js";

const WORKFLOWS_DIR = ".rlm/workflows";

export function resolveGraphWorkflowsDir(projectRoot = process.cwd()): string {
  return join(projectRoot, WORKFLOWS_DIR);
}

export function resolveGraphWorkflowPath(
  workflowId: string,
  input: { projectRoot?: string | undefined; path?: string | undefined } = {},
): string {
  const projectRoot = input.projectRoot ?? process.cwd();
  if (input.path) {
    return resolve(projectRoot, input.path);
  }
  return join(resolveGraphWorkflowsDir(projectRoot), `${workflowId}.yaml`);
}

export async function listGraphWorkflows(
  projectRoot = process.cwd(),
): Promise<GraphWorkflowListEntry[]> {
  const dir = resolveGraphWorkflowsDir(projectRoot);
  let entries: string[];
  try {
    entries = await readdir(dir);
  } catch {
    return [];
  }

  const workflows: GraphWorkflowListEntry[] = [];
  for (const fileName of entries.sort((left, right) => left.localeCompare(right))) {
    if (!fileName.endsWith(".yaml") && !fileName.endsWith(".yml")) {
      continue;
    }
    const id = fileName.replace(/\.(yaml|yml)$/i, "");
    try {
      const sidecar = await loadGraphWorkflowSidecarFromPath(join(dir, fileName));
      workflows.push({
        id: sidecar.graphId || id,
        path: join(WORKFLOWS_DIR, fileName),
        description: sidecar.description,
        updatedAt: sidecar.updatedAt,
        variants: (["playbook", "pipeline"] as const).filter((variant) =>
          Boolean(sidecar.variants[variant]),
        ),
      });
    } catch {
      continue;
    }
  }

  return workflows;
}

export async function loadGraphWorkflowSidecarFromPath(
  path: string,
): Promise<GraphWorkflowSidecar> {
  const raw = await readFile(path, "utf8");
  const parsed = parseYaml(raw) as unknown;
  return parseGraphWorkflowSidecar(parsed);
}

export async function loadGraphWorkflow(
  workflowId: string,
  input: { projectRoot?: string | undefined; path?: string | undefined } = {},
): Promise<GraphWorkflowSidecar> {
  const path = resolveGraphWorkflowPath(workflowId, input);
  return loadGraphWorkflowSidecarFromPath(path);
}

export async function saveGraphWorkflowSidecar(
  sidecar: GraphWorkflowSidecar,
  input: { projectRoot?: string | undefined; path?: string | undefined } = {},
): Promise<{ path: string; sidecar: GraphWorkflowSidecar }> {
  const path = resolveGraphWorkflowPath(sidecar.graphId, input);
  await mkdir(resolveGraphWorkflowsDir(input.projectRoot ?? process.cwd()), { recursive: true });
  const updated: GraphWorkflowSidecar = {
    ...sidecar,
    updatedAt: new Date().toISOString(),
  };
  await writeFile(path, stringifyYaml(updated), "utf8");
  return { path, sidecar: updated };
}

export async function exportAndSaveGraphWorkflow(
  input: GraphWorkflowExportInput & { projectRoot?: string | undefined; path?: string | undefined },
): Promise<{ path: string; sidecar: GraphWorkflowSidecar }> {
  const sidecar = exportSessionGraphToSidecar(input);
  return saveGraphWorkflowSidecar(sidecar, {
    projectRoot: input.projectRoot,
    path: input.path,
  });
}

export function resolveConfiguredGraphWorkflowPath(
  workflowId: string,
  configPath: string | undefined,
  sidecarPath?: string | undefined,
): string {
  const projectRoot = configPath ? resolve(configPath, "..") : process.cwd();
  return resolveGraphWorkflowPath(workflowId, { projectRoot, path: sidecarPath });
}

export function availableVariants(sidecar: GraphWorkflowSidecar): GraphWorkflowVariant[] {
  return (["playbook", "pipeline"] as const).filter((variant) =>
    Boolean(sidecar.variants[variant]),
  );
}

export async function graphWorkflowSidecarExists(
  workflowId: string,
  projectRoot = process.cwd(),
): Promise<boolean> {
  const path = resolveGraphWorkflowPath(workflowId, { projectRoot });
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

export async function resolveDiskGraphWorkflowConfig(
  workflowId: string,
  projectRoot = process.cwd(),
): Promise<GraphWorkflowConfig | undefined> {
  if (!(await graphWorkflowSidecarExists(workflowId, projectRoot))) {
    return undefined;
  }
  try {
    await loadGraphWorkflow(workflowId, { projectRoot });
    return { kind: "graph" };
  } catch {
    return undefined;
  }
}
