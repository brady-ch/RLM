import type { RecursiveModelConfig } from "../domain/types.js";

export interface CliOptions {
  command: "ask" | "help";
  prompt: string;
  config: RecursiveModelConfig;
  compact: boolean;
  json: boolean;
  trace: boolean;
  model: string;
  agent?: string;
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
  let compact = false;
  let json = false;
  let trace = false;
  let model = env.RLM_MODEL ?? "granite4.1:3b";
  let agent: string | undefined;
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

    if (arg === "--depth") {
      config.maxDepth = parsePositiveInteger(readValue(args, index, arg), arg);
      index += 1;
      continue;
    }

    if (arg === "--max-depth") {
      config.maxDynamicDepth = parsePositiveInteger(readValue(args, index, arg), arg);
      index += 1;
      continue;
    }

    if (arg === "--branches") {
      config.maxBranches = parsePositiveInteger(readValue(args, index, arg), arg);
      index += 1;
      continue;
    }

    if (arg === "--max-prompt-chars") {
      config.maxPromptCharacters = parsePositiveInteger(readValue(args, index, arg), arg);
      index += 1;
      continue;
    }

    if (arg === "--max-model-calls") {
      config.maxModelCalls = parsePositiveInteger(readValue(args, index, arg), arg);
      index += 1;
      continue;
    }

    if (arg === "--max-tool-rounds") {
      config.maxToolRounds = parsePositiveInteger(readValue(args, index, arg), arg);
      index += 1;
      continue;
    }

    if (arg === "--model") {
      model = readValue(args, index, arg);
      index += 1;
      continue;
    }

    if (arg === "--agent") {
      agent = readValue(args, index, arg);
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
    compact,
    json,
    trace,
    model,
  };
  if (agent) {
    options.agent = agent;
  }
  if (baseUrl) {
    options.baseUrl = baseUrl;
  }

  return options;
}

export function helpText(): string {
  return [
    "Recursive Language Model",
    "",
    "Usage:",
    "  rlm \"your prompt\" [--agent research] [--json] [--trace]",
    "  rlm ask \"your prompt\" [--depth 2] [--branches 3]",
    "",
    "Options:",
    "  --depth <n>             Override recursion depth. Default: model-selected",
    "  --max-depth <n>         Maximum model-selected recursion depth. Default: 4",
    "  --branches <n>          Maximum subtasks per recursive step. Default: 3",
    "  --max-prompt-chars <n>  Truncate individual task prompts. Default: 6000",
    "  --max-model-calls <n>   Stop recursive expansion after this many model calls. Default: 24",
    "  --max-tool-rounds <n>   Maximum tool-call rounds per model step. Default: 3",
    "  --model <name>          Ollama model. Default: granite4.1:3b or RLM_MODEL",
    "  --agent <id>            Agent override. Default: auto-route. Available: default, research",
    "  --base-url <url>        Ollama base URL. Default: OLLAMA_HOST or LangChain default",
    "  --json                 Print stable JSON output for tool consumption",
    "  --compact              Print compact output for compatibility",
    "  --trace                Print recursion trace",
  ].join("\n");
}

function helpOptions(env: NodeJS.ProcessEnv): CliOptions {
  const options: CliOptions = {
    command: "help",
    prompt: "",
    config: { ...DEFAULT_CONFIG },
    compact: false,
    json: false,
    trace: false,
    model: env.RLM_MODEL ?? "granite4.1:3b",
  };
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
