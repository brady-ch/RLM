import assert from "node:assert/strict";
import test from "node:test";
import { parseYamlTagged } from "../../../src/application/config/loader.js";

test("parseYamlTagged prefixes filesystem path onto YAML syntax errors", () => {
  assert.throws(
    () => parseYamlTagged("custom/path.yaml", "["),
    (err: unknown) => err instanceof Error && /custom\/path\.yaml:/u.test(err.message),
  );
});
