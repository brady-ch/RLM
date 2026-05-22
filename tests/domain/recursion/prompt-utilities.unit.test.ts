import assert from "node:assert/strict";
import test from "node:test";
import {
  clamp,
  fallbackFromMessages,
  isCodeTask,
  limitPrompt,
  parseClarificationRequest,
  parseFirstInteger,
  preview,
  toModelPurpose,
} from "../../../src/domain/recursion/prompt-utilities.js";
import type { RecursiveModelConfig } from "../../../src/domain/types.js";
import type { LanguageModelPort } from "../../../src/ports/language-model-port.js";
import type { TracePort } from "../../../src/ports/trace-port.js";

test("preview trims whitespace and ellipsizes long strings", () => {
  assert.equal(preview("  hello   world "), "hello world");
  const long = "a".repeat(200);
  const out = preview(long, 20);
  assert.equal(out.endsWith("..."), true);
  assert.equal(out.length, 20);
});

test("parseClarificationRequest extracts payload after clarify prefix", () => {
  assert.equal(parseClarificationRequest("CLARIFY: what color?"), "what color?");
  assert.equal(parseClarificationRequest(" clarify : \nx "), "x");
  assert.equal(parseClarificationRequest("not clarify"), undefined);
});

test("parseFirstInteger finds first bounded integer substring", () => {
  assert.equal(parseFirstInteger("depth 3 branches"), 3);
  assert.equal(parseFirstInteger("no digits"), undefined);
});

test("isCodeTask recognizes kind and prefixed prompts", () => {
  assert.equal(isCodeTask({ kind: "code", id: "n", prompt: "x", depth: 1 }), true);
  assert.equal(isCodeTask({ id: "n", prompt: "Code: do it", depth: 0 }), true);
  assert.equal(isCodeTask({ id: "n", prompt: "Run code: x", depth: 0 }), true);
  assert.equal(isCodeTask({ id: "n", prompt: "plain", depth: 0 }), false);
});

test("clamp constrains numeric range", () => {
  assert.equal(clamp(5, 0, 10), 5);
  assert.equal(clamp(-1, 0, 10), 0);
  assert.equal(clamp(99, 0, 10), 10);
});

test("fallbackFromMessages uses last user content", () => {
  const msgs: Parameters<LanguageModelPort["complete"]>[0] = [
    { role: "assistant", content: "hi" },
    { role: "user", content: "last" },
  ];
  assert.equal(fallbackFromMessages(msgs), "last");
});

test("toModelPurpose maps trace kinds used by recursion", () => {
  assert.equal(toModelPurpose("classify"), "classify");
  assert.equal(toModelPurpose("summarize"), "summarize");
  const unmapped: Parameters<TracePort["record"]>[0]["kind"] = "error";
  assert.equal(toModelPurpose(unmapped), undefined);
});

test("limitPrompt trims to maxPromptCharacters config", () => {
  const short: RecursiveModelConfig = {
    maxDynamicDepth: 0,
    maxBranches: 4,
    maxPromptCharacters: 10,
    maxModelCalls: 50,
    maxToolRounds: 0,
  };
  const tiny: RecursiveModelConfig = { ...short, maxPromptCharacters: 3 };
  assert.equal(limitPrompt("abc", short), "abc");
  assert.equal(limitPrompt("abcdefghij", tiny), "abc");
});
