import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import {
  DEB_BUNDLE_REL,
  findDebArtifact,
  missingDebMessage,
  shouldSkipDebSmoke,
} from "./deb-smoke-lib.mjs";

test("shouldSkipDebSmoke with RLM_SKIP_DEB_SMOKE=1 returns skip true", () => {
  const result = shouldSkipDebSmoke({ RLM_SKIP_DEB_SMOKE: "1" }, "linux");
  assert.equal(result.skip, true);
  assert.match(result.reason ?? "", /RLM_SKIP_DEB_SMOKE=1/);
});

test("shouldSkipDebSmoke on darwin returns skip true with Linux-only reason", () => {
  const result = shouldSkipDebSmoke({}, "darwin");
  assert.equal(result.skip, true);
  assert.match(result.reason ?? "", /Linux-only/i);
});

test("findDebArtifact without bundle/deb returns null and message references bundle/deb", () => {
  const emptyRoot = mkdtempSync(join(tmpdir(), "rlm-deb-smoke-"));
  try {
    const artifact = findDebArtifact(emptyRoot);
    assert.equal(artifact, null);
    assert.match(missingDebMessage(), /bundle\/deb/);
    assert.match(DEB_BUNDLE_REL, /bundle\/deb/);
  } finally {
    rmSync(emptyRoot, { recursive: true, force: true });
  }
});
