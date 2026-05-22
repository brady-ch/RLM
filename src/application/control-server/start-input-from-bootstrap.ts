import type { RuntimeContext } from "../bootstrap/types.js";
import type { StartControlServerInput } from "./types.js";

/** UI/composition fields for control server excluding bootstrap-owned cwd + persisted session adapter. */
export type StartControlServerUiExtras = Omit<
  StartControlServerInput,
  "projectRoot" | "sessionStore"
>;

/**
 * Merges bootstrap-owned paths and stores into the UI-composed server input — route handlers remain consumers only.
 */
export function buildStartControlServerInput(
  ctx: Pick<RuntimeContext, "cwd" | "sessionStore">,
  extras: StartControlServerUiExtras,
): StartControlServerInput {
  return {
    ...extras,
    projectRoot: ctx.cwd,
    sessionStore: ctx.sessionStore,
  };
}
