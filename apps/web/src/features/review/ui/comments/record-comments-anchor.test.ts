import { describe, expectTypeOf, it } from "vitest";

import type { RecordCommentAnchor } from "./record-comments";

const itemAnchor = { itemId: "item-1" } satisfies RecordCommentAnchor;
const riskAnchor = { riskId: "risk-1" } satisfies RecordCommentAnchor;
const decisionAnchor = {
  decisionId: "decision-1",
} satisfies RecordCommentAnchor;

const multiRecordAnchor = {
  itemId: "item-1",
  riskId: "risk-1",
};
const emptyAnchor = {};

describe("RecordCommentAnchor", () => {
  it("accepts single-record anchors and rejects empty or multi-record anchors", () => {
    expectTypeOf(itemAnchor).toExtend<RecordCommentAnchor>();
    expectTypeOf(riskAnchor).toExtend<RecordCommentAnchor>();
    expectTypeOf(decisionAnchor).toExtend<RecordCommentAnchor>();
    expectTypeOf(multiRecordAnchor).not.toExtend<RecordCommentAnchor>();
    expectTypeOf(emptyAnchor).not.toExtend<RecordCommentAnchor>();
  });
});
