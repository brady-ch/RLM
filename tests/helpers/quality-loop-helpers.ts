import assert from "node:assert/strict";
import type { QualityLoopMetadata } from "../../src/domain/types.js";

export function assertQualityLoopTerminal(
  loop: QualityLoopMetadata | undefined,
  expected: {
    status: QualityLoopMetadata["status"];
    stopReason: NonNullable<QualityLoopMetadata["stopReason"]>;
    issueText?: RegExp;
  },
) {
  assert.equal(loop?.status, expected.status);
  assert.equal(loop?.stopReason, expected.stopReason);
  assert.ok(
    loop?.message !== undefined ||
      loop?.unresolvedIssues.length !== 0 ||
      loop?.gate !== undefined ||
      loop?.selection !== undefined,
  );
  if (expected.issueText) {
    const diagnostic = [
      loop?.message,
      ...(loop?.unresolvedIssues.map((issue) => issue.text) ?? []),
      ...(loop?.iterations.flatMap((iteration) =>
        iteration.unresolvedIssues.map((issue) => issue.text),
      ) ?? []),
    ]
      .filter(Boolean)
      .join("\n");
    assert.match(diagnostic, expected.issueText);
  }
}
