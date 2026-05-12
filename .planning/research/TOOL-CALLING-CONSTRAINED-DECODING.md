# Constrained decoding for tool calling (Outlines-style)

Research for **recursive-language-modelv1**: enforce tool selection and arguments **during token generation** (logit-level / sampler constraints), analogous to Python [Outlines](https://github.com/dottxt-ai/outlines), rather than trusting free-form assistant text plus post-parse repair.

> **Read order:** Skim §0 (Revision, current) for the operative facts and recommendations. §§1–7 are the original draft; some hedging there is **superseded** by §0.

## 0. Revision — 2026-05-09

### 0.1 TL;DR of corrections

- **Ollama `format: <JSONSchema>` is real token-level masking, not post-hoc parsing.** Ollama compiles the supplied JSON Schema → llama.cpp **GBNF grammar** → `GrammarSampler` that masks logits to `-inf` for grammar-violating tokens at every step ([Ollama "Structured outputs" blog, 2024-12-06](https://ollama.com/blog/structured-outputs); [PR #7900: structured-outputs chat endpoint](https://github.com/ollama/ollama/pull/7900); [PR #8123: `llm/grammar` package](https://github.com/ollama/ollama/pull/8123); [danielclayton.co.uk write-up](https://blog.danielclayton.co.uk/posts/ollama-structured-outputs/)). Mechanism is **the same family** as Outlines (FSM mask over the vocabulary); the schema-compiler is different (Ollama: schema → GBNF; Outlines: schema → regex → FSM via `outlines-core`).
- **`tools` and `format` are mutually exclusive in practice on Ollama.** Combining a non-empty `tools` array with a JSON-Schema `format` returns an **empty `tool_calls` array** ([ollama#8095](https://github.com/ollama/ollama/issues/8095)). And `tool_choice` is silently ignored ([ollama#7778](https://github.com/ollama/ollama/issues/7778), [ollama#11171](https://github.com/ollama/ollama/issues/11171), [ollama#14967](https://github.com/ollama/ollama/issues/14967)) — there is no server-side way to force "must call a tool".
- **Native Ollama tool calling is *not* constrained at decode time.** The chat endpoint accepts a free-form assistant message, then a post-hoc parser extracts `tool_calls` from it ([docs.ollama.com/capabilities/tool-calling](https://docs.ollama.com/capabilities/tool-calling)). Reliability depends entirely on the model's tool-call template fidelity.
- **LangChain's `ChatOllama` exposes `format` but not logprobs**, and `tool_choice` is documented as deprecated. Details in §0.3 below. The current adapter (`src/adapters/ollama-language-model.ts`) leaves `format` on the table.
- **There is no pure-TS Outlines-equivalent.** The closest in-process option is `node-llama-cpp` (its own GBNF / JSON-Schema grammar, llama.cpp inference only). For real Outlines parity you bridge to a Python sidecar or vLLM. See §0.6.

### 0.2 Pinned versions (from `package-lock.json`)

| Package | Resolved version | Notes |
|---|---|---|
| `@langchain/core` | **1.1.44** | `package-lock.json:817-820` |
| `@langchain/ollama` | **1.2.7** | `package-lock.json:961-964`; depends on `ollama@^0.6.3` |
| `langchain` | **1.3.5** | `package-lock.json:2095-2098` |
| `ollama` (transitive) | **0.6.3** | `package-lock.json:2229-2232` |
| `zod` | **^4.4.3** (declared) | `package.json:13`; usable for envelope schema |

These are the upper bounds on what's actually wired today. Anything below assumes these exact versions.

### 0.3 LangChain JS / Ollama capability matrix (verified against installed sources)

| Capability | Surface in `ChatOllama@1.2.7` | Surface in `ollama@0.6.3` JS SDK | Verdict for this repo |
|---|---|---|---|
| **`format: "json"`** (any-JSON mode) | `format?: string \| Record<string, any>` on constructor and per-call options (`chat_models.d.ts:20-22, 66, 404`) | `ChatRequest.format?: string \| object` (`shared/ollama.*.d.ts:99`) | Available now. Loose. |
| **`format: <JSONSchema>`** (full Schema → GBNF) | Same field; `withStructuredOutput(schema, { method: "jsonSchema" })` defaults to setting `format: jsonSchema` via `withConfig` (`chat_models.js:566-611`) | Same field accepts arbitrary object | **This is the core hook.** Use it. |
| **`tools` (OpenAI-style functions)** | `bindTools(tools)` → converts via `convertToOpenAITool` and `withConfig({ tools })` (`chat_models.js:430-435`) | `ChatRequest.tools?: Tool[]` | Works, but post-hoc parse only. |
| **`tool_choice`** | Type-level marked `@deprecated Tool choice is not supported for ChatOllama` (`chat_models.d.ts:21-22`) | Not a field at all | **Cannot force tool selection** through any layer. |
| **`tools` + `format` together** | Both can be set; LangChain doesn't reject it | Server returns empty `tool_calls` ([ollama#8095](https://github.com/ollama/ollama/issues/8095)) | Pick one path per call. |
| **`logprobs` / `top_logprobs`** | **Not in `invocationParams`** (`chat_models.js:447-487`) — silently dropped if you pass via `withConfig` | Available on both `ChatRequest` and `GenerateRequest` (`shared/ollama.*.d.ts:103-104, 53-54`); response carries `Logprob[]` (`*.d.ts:156-178, 191`) | To use logprobs you must call the raw `ollama` SDK (or `fetch`) and bypass `ChatOllama`. |
| **Raw GBNF / grammar passthrough** | None | None — neither `ChatRequest` nor `GenerateRequest` has a `grammar` field | Only reachable via baked-in Modelfile `parameter` or by recompiling Ollama. Treat as unavailable. |
| **`think` (reasoning toggle)** | `think?: boolean` constructor field (`chat_models.d.ts:72`) | `ChatRequest.think?: boolean \| 'high' \| 'medium' \| 'low'` | Available. Note: thinking text is in `message.thinking`, not `message.content`. |
| **Stop sequences** | `stop?: string[]` per call → `options.stop` | `Options.stop: string[]` | Useful for two-phase decoding (§0.6 option 3). |

**Implication for the adapter:** the cleanest constrained-decoding lever the current stack already ships with is `format: <JSONSchema>` on `ChatOllama` per call — but the moment we want logprobs *or* a "force-this-tool" gate, we have to drop down past LangChain to the raw `ollama` client.

### 0.4 Ollama vs Outlines: same mechanism, different compiler

| | Outlines (steerable models) | Ollama (`format: <schema>`) |
|---|---|---|
| Schema → constraint | `outlines-core` (Rust): JSON Schema → regex → FSM `Index` over `Vocabulary` ([outlines-core](https://github.com/dottxt-ai/outlines-core); [`outlines/fsm/guide.py`](https://github.com/outlines-dev/outlines/blob/ae9ae50/outlines/fsm/guide.py)) | Go converter (`llm/grammar`, [PR #8123](https://github.com/ollama/ollama/pull/8123)) replaces llama.cpp's `schema_to_grammar` → GBNF |
| Decode-time enforcement | `LogitsProcessor` masks invalid tokens to `-inf`; chosen token advances FSM ([Outlines architecture guide](https://dottxt-ai.github.io/outlines/main/guide/architecture/)) | llama.cpp `GrammarSampler` masks tokens that don't decode to grammar-valid character sequences |
| "Multiple choices" path | `Literal[...]`, `Enum`, `Choice([...])` → regex alternation | Schema with `enum: [...]` → GBNF alternation |
| Speculative skipping | "Coalescent" generation: when FSM has only one outgoing edge, write fixed tokens without sampling | Highest-probability-token-first check; falls back to full vocab masking only on rejection |
| Black-box backends (OpenAI etc.) | Defers to provider's structured-output API; no real masking | Same — Ollama's OpenAI-compat endpoint forwards `response_format` to its own grammar sampler |

**Net:** the original §1–4 framing of "Outlines = real masking, Ollama `format` = maybe-soft" is wrong for current Ollama. For **JSON-shaped tool envelopes** the two are mechanically equivalent. The places they still diverge:

- **Choice over an open vocabulary that isn't a JSON shape** (e.g., regex-only output, free-prose constrained by a CFG): Outlines has `Regex(...)` and `CFG(...)` first-class; Ollama only exposes JSON Schema. To get pure regex/CFG you'd need a sidecar.
- **Per-token observability** (logprobs of masked branches, beam pruning, custom samplers): Ollama returns `Logprob[]` if asked, but doesn't expose the mask state. Outlines/`outlines-core` lets you inspect `Index` transitions.
- **Forcing the choice of tool (a closed `Choice` over tool names *as the first action*)**: trivial in Outlines (`Literal[*tool_names]`); on Ollama you simulate it via a JSON envelope whose `name` field is `enum: [...]` — works, but tied to the JSON shape.

### 0.5 Outlines internals — one-screen summary

1. **Type → constraint compilation.**
   - `Literal["pizza", "burger"]` / `Choice([...])` / `Enum` → regex alternation (`pizza|burger`).
   - `JsonSchema(...)` / Pydantic / dataclass → `outlines-core` walks the schema and emits a regex that matches every valid serialization of the type, including whitespace.
   - `Regex(r"...")` → used directly. `CFG(...)` → Lark grammar parsed then handled by a CFG-specific guide.
2. **Vocabulary index.** `Index(vocabulary, regex)` returns an FSM whose alphabet is **token ids**, not characters. Each state stores the set of token ids that keep the regex satisfiable, plus the next state for each. Built once per `(vocab, schema)` pair, cached.
3. **Decode loop (`LogitsProcessor`).** At step *t*: read current FSM state → look up allowed token-id set → set logits of all other ids to `-inf` → softmax → sample → advance FSM with the chosen id. Only applies to "steerable" backends with logits access (Transformers, llama.cpp, MLX). Black-box hosts route through their own structured-output APIs ([architecture guide](https://dottxt-ai.github.io/outlines/main/guide/architecture/)).
4. **Coalescence.** When the allowed-set has size 1 for several consecutive states, the decoder writes those tokens directly without sampling — this is the optimization that makes large schemas tractable.
5. **Output is always a string.** Caller does the final `model_validate_json` cast.

Theoretical reference: Willard & Louf, [*Efficient Guided Generation for Large Language Models*](https://arxiv.org/abs/2307.09702) (2023). Code references: [`outlines-core`](https://github.com/dottxt-ai/outlines-core), [`outlines/fsm/guide.py`](https://github.com/outlines-dev/outlines/blob/ae9ae50/outlines/fsm/guide.py), processors under `outlines/processors/`.

### 0.6 Implementation options prioritized for this TS repo

Anchored on `src/ports/language-model-port.ts` (`complete`, `tools`, `toolCalls`), `src/adapters/ollama-language-model.ts` (current `bindTools` path), `src/domain/recursive-language-model.ts:403-525` (tool-round loop).

#### Option A — Single-call JSON envelope via `format: <JSONSchema>` *(recommended starting point)*

Replace, **per request that needs constrained tool-calling**, the `bindTools` path with a single `format`-constrained call. Envelope schema:

```jsonc
{
  "type": "object",
  "additionalProperties": false,
  "required": ["choice"],
  "properties": {
    "choice": {
      "oneOf": [
        { "type": "object", "additionalProperties": false,
          "required": ["kind", "final"],
          "properties": {
            "kind": { "const": "final" },
            "final": { "type": "string" }
          }
        },
        { "type": "object", "additionalProperties": false,
          "required": ["kind", "tool", "args"],
          "properties": {
            "kind": { "const": "tool_call" },
            "tool": { "enum": ["read_file", "shell", "web_search", "..."] },
            "args": { /* discriminated by `tool` via oneOf or per-tool branch */ }
          }
        }
      ]
    }
  }
}
```

Why this works:
- Ollama compiles the whole envelope to a single GBNF → token-level masked. The `enum` on `tool` mechanically forbids any unknown tool name (this is the Outlines "multiple choices" pattern, expressed in JSON-Schema terms).
- The model can still "decide not to call a tool" by emitting `{"kind":"final", ...}`, so we keep the existing recursion semantics in `recursive-language-model.ts`.
- One model call per round (no two-phase latency overhead).

Adapter wiring (`OllamaLanguageModelAdapter.complete`):
1. If `options.tools?.length` and the new `options.constrainedFormat === true` (additive flag on `LanguageModelCompleteOptions`), build the envelope schema from `options.tools[].schema` (each tool's existing JSON Schema) plus the closed `enum` of names.
2. Pass it via the `format` per-call option: `await this.client.invoke(messages, { format: envelopeSchema })`. Per `chat_models.js:447-487`, this routes to the Ollama chat call's `format` field.
3. Parse the assistant content (`JSON.parse`, validate with the same Zod we already use). Map `{"kind":"tool_call", "tool", "args"}` → `LanguageModelToolCall[]`. Map `{"kind":"final", "final"}` → `content`.
4. Continue to honor `tools = []` in the *next* round (when feeding tool results back), since the model is supposed to summarize, not re-call.

Caveats:
- Per [ollama#8095](https://github.com/ollama/ollama/issues/8095), do **not** pass both `tools` and `format` in the same request — drop `tools` from the request when `format` is set. The schema is the constraint.
- Some Ollama models still emit thinking tokens around the JSON; keep `temperature: 0` and `think: false` (or strip `message.thinking`) to keep the output a single JSON object.

**Effort:** ~1 day. Net new code: an envelope-builder module + a small branch in the adapter. No changes needed in `recursive-language-model.ts` if the adapter still emits `toolCalls`.

#### Option B — Two-phase: tool name (constrained `enum`) → arguments (per-tool schema)

Same `format` mechanism, but split:
- Call 1: `format: { type: "object", required: ["tool"], properties: { tool: { enum: [...] } }, additionalProperties: false }`. Cheap, ~5–20 tokens.
- Call 2: `format: <chosenTool.schema>`, with system message reminding the model what `tool` was selected.

Pros over A: smaller per-call grammar (faster compile, simpler debugging); easier to log "what did the router pick?" telemetry; handles dynamic per-user tool sets without recompiling a giant union.

Cons: 2× round-trip latency per tool round; can desync if the second call's prompt template doesn't accurately re-state the choice. Worth it when `tools.length > ~12` or when individual tool schemas are large.

#### Option C — `node-llama-cpp` adapter (in-process TS, llama.cpp grammar)

[`node-llama-cpp`](https://node-llama-cpp.withcat.ai/guide/grammar) ships a `LlamaJsonSchemaGrammar` (`createGrammarForJsonSchema`) and arbitrary GBNF grammars; v3.10 added `$defs`/`$ref` support. This gives us **token-level masking inside a Node process**, no Ollama, no Python.

When to consider: we want guarantees on developer workstations without running Ollama, or we want logprobs/beam-control hooks Ollama doesn't expose. New adapter implementing `LanguageModelPort`. Real cost is operational: model files are loaded into the Node process, GPU/CPU layer config is per-machine, and llama.cpp version compatibility windows are narrow.

#### Option D — Python Outlines sidecar (FastAPI / Uvicorn)

Tiny Python service (`POST /constrained-complete` → `{ messages, output_type, model }`) using Outlines + Transformers/vLLM/llama.cpp. New `OutlinesSidecarLanguageModelAdapter` implements `LanguageModelPort`. Returns either `content` or `toolCalls`. Behind a feature flag in `rlm.config.yaml`.

Earns its weight when we need **regex-only or CFG-only** outputs (e.g., a strict shell-command grammar) that JSON Schema can't express — which is exactly Outlines' superpower over Ollama's current `format`.

#### Option E — vLLM with `guided_json` / `guided_choice` / `guided_regex`

vLLM's structured outputs (default backend `xgrammar`, optional `outlines`) support `choice`, `regex`, `json`, `grammar`, `structural_tag` ([vLLM docs](https://docs.vllm.ai/en/latest/api/vllm/config/structured_outputs/)). Surface via vLLM's OpenAI-compat endpoint. New `VllmLanguageModelAdapter` (or just point an OpenAI-compat client at the URL).

Earns its weight in deployment, not local dev: same TS code path, but the server we control has Outlines-equivalent enforcement and real `tool_choice`/`response_format=json_schema` semantics.

#### Option F — Pluggable port (orthogonal, do alongside A/B)

Either widen `LanguageModelCompleteOptions` with `responseFormat?: unknown` (JSON Schema object) **and** `forceTool?: string` (advisory; respected by adapters that can; ignored by `ChatOllama`), or introduce `ConstrainedLanguageModelPort extends LanguageModelPort`. Keeps `recursive-language-model.ts` agnostic of which adapter is wired in — that's the part of the original §3 worth keeping.

Recommended: **start with Option A behind a `responseFormat` flag on the existing port (Option F-lite)**. Promote to B if union-schema latency hurts. Add D or E only when we hit JSON-Schema's expressivity ceiling or need real `tool_choice: required`.

### 0.7 Decision matrix

Effort scale: XS = ~1 file change; S = ~1 day; M = a few days incl. adapter; L = new infra.
Guarantee: low = post-parse only; med = JSON-Schema-FSM (Ollama/vLLM xgrammar); high = arbitrary regex/CFG token-mask (Outlines/llama.cpp grammar) + force-tool semantics.

| # | Option | Effort | Constraint guarantee | Force-tool? | Logprobs? | Portability | Latency hit |
|---|---|---|---|---|---|---|---|
| A | `format: <envelope>` via `ChatOllama` | XS–S | Med (token-masked GBNF) | Implicit (envelope makes "no tool" an explicit branch) | No (LangChain drops it) | High — any Ollama ≥ 0.5 | Schema compile once + small per-step mask cost |
| B | Two-phase `enum` then args | S | Med + tighter on tool name | Yes via `enum` on `tool` | No through LangChain | High | 2× round-trips per tool call |
| C | `node-llama-cpp` adapter | M | High (GBNF, full grammar) | Yes (you own the sampler) | Yes | Low — only that runtime, only certain GGUF models | Local model load time dominates |
| D | Python Outlines sidecar | M–L | High (FSM + regex/CFG) | Yes | Yes | Med — extra process, but model-agnostic | +IPC; mitigated by colocation |
| E | vLLM guided decoding | M (server) + S (client) | High | Yes (`tool_choice: required`) | Yes | High once deployed | Server-side; xgrammar is fast |
| F | Port-level abstraction | XS–S | n/a | n/a | n/a | n/a | n/a |

### 0.8 Concrete next step

1. Add `responseFormat?: Record<string, unknown>` to `LanguageModelCompleteOptions` in `src/ports/language-model-port.ts`.
2. In `OllamaLanguageModelAdapter.complete`, if `options.responseFormat` is set:
   - Skip `bindTools`. Call `this.client.invoke(messages, { format: options.responseFormat })`.
   - Parse `response.content` as JSON; on failure, surface a typed `ConstrainedDecodeError` (do not silently coerce).
3. Add `src/domain/tool-envelope.ts` that, given `LanguageModelTool[]`, produces the envelope JSON Schema described in §0.6 A.
4. In `recursive-language-model.ts`, gate envelope mode behind a config flag (`maxToolRounds` semantics unchanged); call sites that opt in pass `responseFormat: buildToolEnvelope(tools)` and an empty `tools` array to the adapter.
5. Tests: round-trip a forced unknown tool name (must fail at parse time, not silently); round-trip valid args; verify `temperature: 0` deterministic JSON for a fixed seed.

What we explicitly **do not** do here: try to make `bindTools` + `format` work together (server returns empty `tool_calls`), or rely on `tool_choice` (ignored).

---

## 1. What Outlines does (Multiple choices and beyond)

[Outlines output types](https://dottxt-ai.github.io/outlines/latest/features/core/output_types/) let you pass an **output type** with the prompt (`model(prompt, output_type, ...)`). The library ensures generated text conforms to that type **while decoding**, not only after the fact.

Relevant categories for tool calling:

| Mechanism | Outlines construct | Typical use |
|-----------|-------------------|-------------|
| **Multiple choices** | `Literal[...]`, `Enum`, or dynamic `Choice([...])` | Force the next span to be exactly one of a closed set (e.g. tool **names**). |
| **JSON-shaped output** | Pydantic / `JsonSchema(...)` | Force a JSON object matching a schema (e.g. tool **arguments**). |
| **Regex / CFG** | `Regex(...)`, `CFG(...)` | Custom token-level constraints beyond JSON. |

Outlines **returns a string**; you still `model_validate_json` (or equivalent) on the client. The guarantee is that the string is in the intended language **by construction of the sampler** (masking / guiding disallowed continuations), not by hoping the model cooperates then fixing errors.

Official README feature row links multiple choices → [Output types → Multiple choices](https://dottxt-ai.github.io/outlines/latest/features/core/output_types/#multiple-choices).

## 2. Tool calling via constrained decoding

**Native chat “tools” APIs** (e.g. model-specific tool protocols) often expose tool calls as structured fields from the server. That is **not always** the same as user-defined logit masking; behavior depends on the backend.

**Outlines-style tool calling** usually decomposes into:

1. **Discrete tool id** — treat as a **multiple-choice** generation (or a small finite prefix before argument JSON).
2. **Arguments** — treat as **JSON constrained by schema** (per-tool schema, or a discriminated union over tools).

**Tradeoffs**

- **Pros:** Fewer invalid tool names, malformed JSON, and “helpful” prose around tool calls; easier audit and deterministic retries.
- **Cons:** Requires a backend that supports constrained decoding (or a custom inference path); compiling unions of large schemas can add complexity and latency; dynamic tool lists imply regenerating masks or grammars per request.

**vs.** current repo path (`ChatOllama` + `bindTools` in `src/adapters/ollama-language-model.ts`): reliance on whatever Ollama/LangChain emits as `tool_calls` from unconstrained conversation completion, without this repo owning the mask/grammar layer.

## 3. Mapping to `LanguageModelPort` in this repo

Today:

- `LanguageModelPort.complete(messages, options?)` accepts optional **`tools`** (name, description, schema).
- Responses are **`content` + `toolCalls`** (`src/ports/language-model-port.ts`).

**Minimal extension directions** (pick one primary strategy):

1. **JSON envelope + schema `format`**  
   - Add optional `LanguageModelCompleteOptions` such as `responseFormat?: unknown` (JSON Schema object) or a dedicated flag that means “single JSON object matching this schema.”  
   - Adapter calls Ollama **HTTP** with `format: <schema>` (see §4), parses JSON, maps `{ tool, arguments }` → `toolCalls`.

2. **Two-phase generation**  
   - Call 1: constrain output to **tool name only** (`Literal`-style — may be approximated by a tiny schema or grammar if the stack supports it).  
   - Call 2: constrain to **JSON arguments** for the chosen tool’s schema.  
   - Central engine (`recursive-language-model.ts`) stays similar; adapter owns orchestration.

3. **Sidecar / Python microservice (Outlines)**  
   - Keep TypeScript orchestration; delegate **constrained** completions to a small Python process using Outlines + vLLM/transformers/Ollama where supported.  
   - Higher ops cost; maximum alignment with Outlines patterns.

4. **Pluggable “constrained backend”**  
   - New port, e.g. `ConstrainedLanguageModelPort`, or optional methods on the existing port, so Ollama vs sidecar vs cloud differ without entangling recursion logic.

**Important:** LangChain’s `ChatOllama` may not expose every Ollama constraint knob; you may need **direct `fetch` to `/api/chat` or `/api/generate`** to pass `format` (JSON schema) reliably. Verify against the LangChain version pinned in this project.

## 4. Backend matrix (where logit/token constraints actually live)

| Backend | Practical constraint API | Notes for tool calling |
|---------|---------------------------|-------------------------|
| **Ollama** | **Structured outputs:** `format: "json"` or `format: { ... JSON Schema ... }` on generate/chat ([Generate API docs](https://docs.ollama.com/api/generate), same pattern in OpenAPI for structured outputs). | Strong fit for **argument JSON**. Map a schema that represents one tool call (or union of tools) into `LanguageModelResponse.toolCalls`. Confirm behavior on your **installed Ollama version** and model family. |
| **Ollama** | **GBNF / grammar** | Historically discussed in Ollama/llama.cpp ecosystem (e.g. PRs/issues around grammar). Not all versions or docs surface the same fields; treat as **version-specific** and test before depending on it. |
| **vLLM** | Structured output / guided decoding (JSON schema, regex, etc., depending on version) | Good for servers you control; integrate similarly via HTTP or dedicated client. |
| **llama.cpp** | Grammar (GBNF) in many builds | Low-level; useful when you bundle inference yourself. |
| **Transformers + Outlines** | Outlines-native | Reference implementation of the pattern the user cited; Python-only path. |

**Logprobs:** Ollama’s API can return **logprobs** for analysis ([OpenAPI `logprobs` / `top_logprobs`](https://docs.ollama.com/api/generate)). That helps **debugging** and confidence scoring; it is **not** the same as enforcing constraints unless you implement a custom loop (usually unnecessary if `format`/grammar is available).

## 5. Recommended phased approach

1. **MVP — JSON Schema envelope on Ollama**  
   - Define one JSON Schema for `{ "name": enum of tool names, "arguments": { ... } }` or per-step schemas.  
   - Bypass or extend the LangChain adapter to pass `format`.  
   - Validate with Zod/`JSON.parse` + map to existing `toolCalls` shape.

2. **Stricter — two-step or union schema**  
   - Reduce cross-tool argument confusion: first step only tool id; second step only that tool’s parameter schema.

3. **Parity with Outlines**  
   - If you need identical semantics across many hosts, evaluate a **Python Outlines** worker or vLLM guided decoding behind a small API.

**Risks**

- **Portability:** JSON Schema support and quality vary by model and server version.  
- **Latency:** Extra compilation or larger FSMs for big unions.  
- **Eval:** Constrained decoding fixes syntax; **semantic** wrong tool/wrong args still require tests and rubrics.

## 6. JavaScript ecosystem gap

Fully general **Outlines-equivalent** constrained decoding in pure TypeScript is uncommon; most teams use **provider-native structured output** (`format`/grammar), **server-side** sandboxes (Python), or **cloud APIs** with JSON schema guarantees. Planning should assume either **HTTP to a capable backend** or a **sidecar**.

## 7. References

- Outlines README: [github.com/dottxt-ai/outlines](https://github.com/dottxt-ai/outlines)  
- Outlines output types (multiple choices, JSON Schema, Regex, CFG): [dottxt-ai.github.io/outlines/latest/features/core/output_types/](https://dottxt-ai.github.io/outlines/latest/features/core/output_types/)  
- Ollama generate API (structured `format`): [docs.ollama.com/api/generate](https://docs.ollama.com/api/generate)  
- This repo: `src/ports/language-model-port.ts`, `src/adapters/ollama-language-model.ts`, `src/domain/recursive-language-model.ts`

---

**Top recommendations (executive)**

1. **Start with Ollama `format` + JSON Schema** expressing a single tool call (or two-phase name then args), wired through a thin HTTP path in an adapter—not only `bindTools`—then map JSON → `toolCalls`.  
2. **Treat Outlines’s “multiple choices” as the pattern for tool names**: in Ollama terms, prefer a **small closed schema** (`enum`) for `name` rather than prose.  
3. **Isolate constraint logic behind the port**: recursion stays on `toolCalls`; adapters own schema construction, versioning, and fallbacks when the runtime lacks structured output.
