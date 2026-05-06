import type { RecursiveModelConfig } from "../domain/types.js";

export interface CliOptions {
  command: "ask" | "help";
  prompt: string;
  config: RecursiveModelConfig;
  configOverrides: Partial<RecursiveModelConfig>;
  compact: boolean;
  json: boolean;
  trace: boolean;
  verbose: boolean;
  model: string;
  modelOverride?: string;
  agent?: string;
  workflow?: string;
  configPath?: string;
  baseUrl?: string;
}

const DEFAULT_CONFIG: RecursiveModelConfig = {
  maxDynamicDepth: 4,
  maxBranches: 3,
  maxPromptCharacters: 6_000,
  maxModelCalls: 24,
  maxToolRounds: 3,
};

export function parseArgs(argv: string[], env: NodeJS.ProcessEnv = process.env): CliOptions {
  const [commandCandidate, ...rest] = argv;
  if (!commandCandidate || commandCandidate === "help" || commandCandidate === "--help" || commandCandidate === "-h") {
    return helpOptions(env);
  }

  const args = commandCandidate === "ask" ? rest : argv;

  const config = { ...DEFAULT_CONFIG };
  const configOverrides: Partial<RecursiveModelConfig> = {};
  let compact = false;
  let json = false;
  let trace = false;
  let verbose = env.RLM_VERBOSE === "1" || env.RLM_VERBOSE === "true";
  let model = env.RLM_MODEL ?? "granite4.1:3b";
  let modelOverride = env.RLM_MODEL;
  let agent: string | undefined;
  let workflow: string | undefined;
  let configPath: string | undefined;
  let baseUrl = env.OLLAMA_HOST;
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

    promptParts.push(arg);
  }

  const prompt = promptParts.join(" ").trim();
  if (!prompt) {
    throw new Error("Missing prompt. Example: npm run dev -- ask \"Explain recursive prompting\"");
  }

  const options: CliOptions = {
    command: "ask",
    prompt,
    config,
    configOverrides,
    compact,
    json,
    trace,
    verbose,
    model,
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
    "",
    "Options:",
    "  --depth <n>             Override YAML runtime recursion depth. Default: model-selected",
    "  --max-depth <n>         Override YAML runtime maximum model-selected recursion depth",
    "  --branches <n>          Override YAML runtime maximum subtasks per recursive step",
    "  --max-prompt-chars <n>  Override YAML runtime task prompt truncation",
    "  --max-model-calls <n>   Override YAML runtime total model-call budget",
    "  --max-tool-rounds <n>   Override YAML runtime maximum tool-call rounds per model step",
    "  --model <name>          Override YAML default Ollama model",
    "  --agent <id>            Agent override. Default: auto-route. Available: default, coding, product_designer, research",
    "  --workflow <id>         Run configured agent workflow. Default workflow id: default",
    "  --config <path>         YAML config path. Default: ./rlm.config.yaml when present",
    "  --base-url <url>        Ollama base URL. Default: OLLAMA_HOST or LangChain default",
    "  --json                 Print stable JSON output for tool consumption",
    "  --compact              Print compact output for compatibility",
    "  --trace                Print recursion trace",
    "  --verbose              Log workflow progress, model calls, completions, and token usage to stderr",
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
    model: env.RLM_MODEL ?? "granite4.1:3b",
  };
  if (env.RLM_MODEL) {
    options.modelOverride = env.RLM_MODEL;
  }
  if (env.OLLAMA_HOST) {
    options.baseUrl = env.OLLAMA_HOST;
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
