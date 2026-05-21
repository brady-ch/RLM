import type { ApprovalMode, RecursiveModelConfig } from "../domain/types.js";

export interface CliOptions {
  command: "ask" | "help" | "ui";
  prompt: string;
  config: RecursiveModelConfig;
  configOverrides: Partial<RecursiveModelConfig>;
  compact: boolean;
  json: boolean;
  trace: boolean;
  verbose: boolean;
  jsonStream: boolean;
  planOnly: boolean;
  requireApproval: boolean;
  approvalMode: ApprovalMode;
  approve: boolean;
  model: string;
  modelOverride?: string;
  agent?: string;
  workflow?: string;
  configPath?: string;
  baseUrl?: string;
  host?: string;
  uiPort?: number;
  sessionList: boolean;
  sessionInspect?: string;
  openSession?: string;
  memoryInspect?: string;
  preferenceSet?: string;
  preferenceDelete?: string;
}

const DEFAULT_QUALITY_LOOP_CONFIG = {
  enabled: false,
  maxIterations: 3,
  budgetBehavior: "stop_before_partial_iteration" as const,
};

const DEFAULT_CONFIG: RecursiveModelConfig = {
  maxDynamicDepth: 4,
  maxBranches: 3,
  maxPromptCharacters: 6_000,
  maxModelCalls: 24,
  maxToolRounds: 3,
  qualityLoop: DEFAULT_QUALITY_LOOP_CONFIG,
};

const DEFAULT_UI_BOOTSTRAP_PROMPT =
  "Create a concise two-step checklist for testing recursive prompting in this workspace.";

export function parseArgs(argv: string[], env: NodeJS.ProcessEnv = process.env): CliOptions {
  const [commandCandidate, ...rest] = argv;
  if (!commandCandidate || commandCandidate === "help" || commandCandidate === "--help" || commandCandidate === "-h") {
    return helpOptions(env);
  }

  const command: CliOptions["command"] = commandCandidate === "ui" ? "ui" : "ask";
  const args = commandCandidate === "ask" || commandCandidate === "ui" ? rest : argv;

  const config = { ...DEFAULT_CONFIG };
  const configOverrides: Partial<RecursiveModelConfig> = {};
  let compact = false;
  let json = false;
  let trace = false;
  let verbose = env.RLM_VERBOSE === "1" || env.RLM_VERBOSE === "true";
  let jsonStream = false;
  let planOnly = false;
  let requireApproval = false;
  let approvalMode: ApprovalMode = "full";
  let approve = false;
  let model = env.RLM_MODEL ?? "granite4.1:3b";
  let modelOverride = env.RLM_MODEL;
  let agent: string | undefined;
  let workflow: string | undefined;
  let configPath: string | undefined;
  let baseUrl = env.OLLAMA_HOST;
  let host = env.RLM_HOST;
  let uiPort: number | undefined;
  let sessionList = false;
  let sessionInspect: string | undefined;
  let openSession: string | undefined;
  let memoryInspect: string | undefined;
  let preferenceSet: string | undefined;
  let preferenceDelete: string | undefined;
  const promptParts: string[] = [];

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg) {
      continue;
    }

    if (arg === "--compact") {
      compact = true;
      continue;
    }

    if (arg === "--json") {
      json = true;
      continue;
    }

    if (arg === "--trace") {
      trace = true;
      continue;
    }

    if (arg === "--verbose") {
      verbose = true;
      continue;
    }
    if (arg === "--json-stream") {
      jsonStream = true;
      continue;
    }
    if (arg === "--plan-only") {
      planOnly = true;
      continue;
    }
    if (arg === "--require-approval") {
      requireApproval = true;
      approvalMode = "full";
      continue;
    }
    if (arg === "--approval-mode") {
      const value = readValue(args, index, arg);
      if (value !== "full" && value !== "initial-plan" && value !== "initial-plan-recursive") {
        throw new Error("--approval-mode must be one of: full, initial-plan, initial-plan-recursive.");
      }
      approvalMode = value;
      requireApproval = true;
      index += 1;
      continue;
    }
    if (arg === "--approve") {
      approve = true;
      continue;
    }

    if (arg === "--depth") {
      const value = parsePositiveInteger(readValue(args, index, arg), arg);
      config.maxDepth = value;
      configOverrides.maxDepth = value;
      index += 1;
      continue;
    }

    if (arg === "--max-depth") {
      const value = parsePositiveInteger(readValue(args, index, arg), arg);
      config.maxDynamicDepth = value;
      configOverrides.maxDynamicDepth = value;
      index += 1;
      continue;
    }

    if (arg === "--branches") {
      const value = parsePositiveInteger(readValue(args, index, arg), arg);
      config.maxBranches = value;
      configOverrides.maxBranches = value;
      index += 1;
      continue;
    }

    if (arg === "--max-prompt-chars") {
      const value = parsePositiveInteger(readValue(args, index, arg), arg);
      config.maxPromptCharacters = value;
      configOverrides.maxPromptCharacters = value;
      index += 1;
      continue;
    }

    if (arg === "--max-model-calls") {
      const value = parsePositiveInteger(readValue(args, index, arg), arg);
      config.maxModelCalls = value;
      configOverrides.maxModelCalls = value;
      index += 1;
      continue;
    }

    if (arg === "--max-tool-rounds") {
      const value = parsePositiveInteger(readValue(args, index, arg), arg);
      config.maxToolRounds = value;
      configOverrides.maxToolRounds = value;
      index += 1;
      continue;
    }

    if (arg === "--quality-loop") {
      const qualityLoop = {
        ...(config.qualityLoop ?? DEFAULT_QUALITY_LOOP_CONFIG),
        enabled: true,
      };
      config.qualityLoop = qualityLoop;
      configOverrides.qualityLoop = qualityLoop;
      continue;
    }

    if (arg === "--quality-loop-max-iterations") {
      const value = parseStrictPositiveInteger(readValue(args, index, arg), arg);
      const qualityLoop = {
        ...(config.qualityLoop ?? DEFAULT_QUALITY_LOOP_CONFIG),
        enabled: true,
        maxIterations: value,
        budgetBehavior: "stop_before_partial_iteration" as const,
      };
      config.qualityLoop = qualityLoop;
      configOverrides.qualityLoop = qualityLoop;
      index += 1;
      continue;
    }

    if (arg === "--model") {
      model = readValue(args, index, arg);
      modelOverride = model;
      index += 1;
      continue;
    }

    if (arg === "--agent") {
      agent = readValue(args, index, arg);
      index += 1;
      continue;
    }

    if (arg === "--workflow") {
      workflow = readValue(args, index, arg);
      index += 1;
      continue;
    }

    if (arg === "--config") {
      configPath = readValue(args, index, arg);
      index += 1;
      continue;
    }

    if (arg === "--base-url") {
      baseUrl = readValue(args, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--host") {
      host = readValue(args, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--ui-port") {
      uiPort = parsePositiveInteger(readValue(args, index, arg), arg);
      index += 1;
      continue;
    }
    if (arg === "--session-list") {
      sessionList = true;
      continue;
    }
    if (arg === "--session-inspect") {
      sessionInspect = readValue(args, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--open-session") {
      openSession = readValue(args, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--memory-inspect") {
      memoryInspect = readValue(args, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--preference-set") {
      preferenceSet = readValue(args, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--preference-delete") {
      preferenceDelete = readValue(args, index, arg);
      index += 1;
      continue;
    }

    promptParts.push(arg);
  }

  const promptInput = promptParts.join(" ").trim();
  let prompt = promptInput;
  if (!promptInput) {
    if (memoryInspect || preferenceSet || preferenceDelete || sessionList || sessionInspect) {
      prompt = "";
    }
    else if (command === "ui") {
      prompt = DEFAULT_UI_BOOTSTRAP_PROMPT;
    }
    else {
      throw new Error("Missing prompt. Example: npm run dev -- ask \"Explain recursive prompting\"");
    }
  }

  const options: CliOptions = {
    command,
    prompt,
    config,
    configOverrides,
    compact,
    json,
    trace,
    verbose,
    jsonStream,
    planOnly,
    requireApproval,
    approvalMode,
    approve,
    model,
    sessionList,
  };
  if (agent) {
    options.agent = agent;
  }
  if (workflow) {
    options.workflow = workflow;
  }
  if (configPath) {
    options.configPath = configPath;
  }
  if (baseUrl) {
    options.baseUrl = baseUrl;
  }
  if (host) {
    options.host = host;
  }
  if (uiPort !== undefined) {
    options.uiPort = uiPort;
  }
  if (sessionInspect) {
    options.sessionInspect = sessionInspect;
  }
  if (openSession) {
    options.openSession = openSession;
  }
  if (memoryInspect) {
    options.memoryInspect = memoryInspect;
  }
  if (preferenceSet) {
    options.preferenceSet = preferenceSet;
  }
  if (preferenceDelete) {
    options.preferenceDelete = preferenceDelete;
  }
  if (modelOverride) {
    options.modelOverride = modelOverride;
  }

  return options;
}

export function helpText(): string {
  return [
    "Recursive Language Model",
    "",
    "Usage:",
    "  rlm \"your prompt\" [--agent coding] [--workflow default] [--json] [--trace]",
    "  rlm ask \"your prompt\" [--depth 2] [--branches 3]",
    "  rlm ui \"your prompt\" [--ui-port 4545]",
    "",
    "Options:",
    "  --depth <n>             Override YAML runtime recursion depth. Default: model-selected",
    "  --max-depth <n>         Override YAML runtime maximum model-selected recursion depth",
    "  --branches <n>          Override YAML runtime maximum subtasks per recursive step",
    "  --max-prompt-chars <n>  Override YAML runtime task prompt truncation",
    "  --max-model-calls <n>   Override YAML runtime total model-call budget",
    "  --max-tool-rounds <n>   Override YAML runtime maximum tool-call rounds per model step",
    "  --quality-loop          Enable bounded answer quality loop mode",
    "  --quality-loop-max-iterations <n>",
    "                          Enable quality loop mode with a positive max iteration bound",
    "  --model <name>          Override YAML default Ollama model",
    "  --agent <id>            Agent override. Default: auto-route. Available: default, coding, product_designer, research",
    "  --workflow <id>         Run configured agent workflow. Default workflow id: default",
    "  --config <path>         YAML config path. Default: ./rlm.config.yaml when present",
    "  --base-url <url>        Ollama base URL. Default: OLLAMA_HOST or LangChain default",
    "  --host <id>             Runtime host id. Precedence: RLM_HOST > --host > YAML runtimeHost > first host",
    "  --json                 Print stable JSON output for tool consumption",
    "                        Exit code 1 when executionStatus is failed or errors are present.",
    "  --compact              Print compact output for compatibility",
    "  --trace                Print recursion trace",
    "  --verbose              Log workflow progress, model calls, completions, and token usage to stderr",
    "  --json-stream          Emit JSON execution events while running",
    "  --plan-only            Build and print execution plan, but do not execute",
    "  --require-approval     Print plan first, then wait for explicit approval before executing",
    "  --approval-mode <mode> Approval behavior: full | initial-plan | initial-plan-recursive",
    "  --approve              Auto-approve a require-approval run (non-interactive)",
    "  --ui-port <n>          Port for local React Flow UI. Default: available port",
    "  --session-list         List saved UI sessions and exit",
    "  --session-inspect <id> Inspect saved session restore verification and exit",
    "  --open-session <id>    Open a saved session in UI mode",
    "  --memory-inspect <run> Inspect memory scopes, episodes, packets, and audit for a run id",
    "  --preference-set <k=v> Set a project memory preference and exit",
    "  --preference-delete <k> Delete a project memory preference and exit",
    "",
    "Environment:",
    '  RLM_UI_DIST=<dir>         Override packaged UI asset directory.',
    '  RLM_NON_INTERACTIVE=1     Skip the interactive launcher; defaults to UI mode.',
    "  RLM_LAUNCH_MODE=cli       Pair with RLM_NON_INTERACTIVE=1 to force CLI mode without a prompt.",
    '  Working directory is treated as the project root for ./rlm.config.yaml and ./.rlm/',
  ].join("\n");
}

function helpOptions(env: NodeJS.ProcessEnv): CliOptions {
  const options: CliOptions = {
    command: "help",
    prompt: "",
    config: { ...DEFAULT_CONFIG },
    configOverrides: {},
    compact: false,
    json: false,
    trace: false,
    verbose: env.RLM_VERBOSE === "1" || env.RLM_VERBOSE === "true",
    jsonStream: false,
    planOnly: false,
    requireApproval: false,
    approvalMode: "full",
    approve: false,
    model: env.RLM_MODEL ?? "granite4.1:3b",
    sessionList: false,
  };
  if (env.RLM_MODEL) {
    options.modelOverride = env.RLM_MODEL;
  }
  if (env.OLLAMA_HOST) {
    options.baseUrl = env.OLLAMA_HOST;
  }
  if (env.RLM_HOST) {
    options.host = env.RLM_HOST;
  }

  return options;
}

function readValue(args: string[], index: number, flag: string): string {
  const value = args[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`Missing value for ${flag}.`);
  }

  return value;
}

function parsePositiveInteger(value: string, flag: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`${flag} must be a non-negative integer.`);
  }

  return parsed;
}

function parseStrictPositiveInteger(value: string, flag: string): number {
  const parsed = parsePositiveInteger(value, flag);
  if (parsed <= 0) {
    throw new Error(`${flag} must be a positive integer.`);
  }

  return parsed;
}
