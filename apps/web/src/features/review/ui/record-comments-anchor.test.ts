import { describe, expect, it } from "vitest";

import type { RecordCommentAnchor } from "./record-comments";

// Compile-time contract: every call site builds a single-record anchor. The
// mutually-exclusive `never` fields make a multi-record state unrepresentable.
const anchors = [
  { itemId: "11111111-1111-4111-8111-111111111111" },
  { riskId: "11111111-1111-4111-8111-111111111112" },
  { decisionId: "11111111-1111-4111-8111-111111111113" },
] satisfies readonly RecordCommentAnchor[];

describe("RecordCommentAnchor", () => {
  it("accepts each single-record anchor shape", () => {
    expect(anchors).toHaveLength(3);
    expect(anchors[0]).toBeDefined();
    expect(anchors[1]).toBeDefined();
    expect(anchors[2]).toBeDefined();
    if (anchors[0] && anchors[1] && anchors[2]) {
      expect("itemId" in anchors[0]).toBe(true);
      expect("riskId" in anchors[1]).toBe(true);
      expect("decisionId" in anchors[2]).toBe(true);
    }
  });
});
