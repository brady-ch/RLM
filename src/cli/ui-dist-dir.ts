import { existsSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";

/**
 * Resolve the directory holding built UI static assets.
 * Order: env RLM_UI_DIST → staged `ui-dist` next to packaged `dist/src` → repo `ui/dist` from inferred root.
 */
export function resolveUiDistDir(entryFile: string, env: NodeJS.ProcessEnv = process.env): string {
  const fromEnv = env.RLM_UI_DIST?.trim();
  if (fromEnv) {
    return isAbsolute(fromEnv) ? resolve(fromEnv) : resolve(process.cwd(), fromEnv);
  }

  const entryDir = dirname(entryFile);

  /** Parent of compilation output root (`dist/`) inferred from emitted `dist/src/index.js`. */
  const inferredRoot = resolve(entryDir, "..", "..");

  const packagedSibling = join(inferredRoot, "ui-dist");
  if (existsSync(packagedSibling)) {
    return packagedSibling;
  }

  return resolve(inferredRoot, "ui", "dist");
}
