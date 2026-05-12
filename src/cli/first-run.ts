export type LaunchResolution = {
  readonly mode: "ui" | "cli";
  readonly shouldPrompt: boolean;
};

export function resolveLaunchMode(
  env: NodeJS.ProcessEnv,
  ttyCombined: boolean,
  choice?: string,
): LaunchResolution {
  const nonInteractive = env.RLM_NON_INTERACTIVE?.trim();
  if (nonInteractive === "1" || nonInteractive?.toLowerCase() === "true") {
    return {
      mode: env.RLM_LAUNCH_MODE?.trim().toLowerCase() === "cli" ? "cli" : "ui",
      shouldPrompt: false,
    };
  }

  if (!ttyCombined) {
    return { mode: "ui", shouldPrompt: false };
  }

  if (choice !== undefined) {
    const normalized = choice.trim().toLowerCase();
    const mode = normalized === "2" || normalized === "cli" ? "cli" : "ui";
    return { mode, shouldPrompt: false };
  }

  return { mode: "ui", shouldPrompt: true };
}

export function formatLaunchModeBanner(): string {
  return [
    "How do you want to use RLM?",
    "  1) UI — open the dashboard in your browser (default — press Enter)",
    "  2) CLI — stay in this terminal prompt",
    "Type 1, 2, ui, or cli and press Enter. Default is 1.",
    "",
  ].join("\n");
}

export async function promptLaunchChoice(): Promise<string> {
  const { createInterface } = await import("node:readline/promises");
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    return await rl.question("");
  } finally {
    rl.close();
  }
}

export function shouldSkipLaunchWizard(argv: readonly string[]): boolean {
  const first = argv[0];
  if (first?.startsWith("-")) {
    return true;
  }

  return (
    first === "help"
    || first === "--help"
    || first === "-h"
    || first === "ui"
    || first === "ask"
  );
}

export function injectLaunchArgv(argv: string[], mode: "ui" | "cli"): string[] {
  const first = argv[0];
  if (!first) {
    return mode === "ui" ? ["ui"] : ["ask"];
  }

  if (first === "help" || first === "--help" || first === "-h") {
    return argv;
  }

  if (first === "ui" || first === "ask") {
    return argv;
  }

  return mode === "ui" ? ["ui", ...argv] : ["ask", ...argv];
}
