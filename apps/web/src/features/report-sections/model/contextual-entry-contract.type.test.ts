import type {
  ItemWorkflowStatus,
  RecordCommentView,
} from "@weeklyreport/shared";
import { expectTypeOf, test } from "vitest";

import type {
  CommentsViewProps,
  DecisionComposerProps,
  ItemComposerProps,
  RiskComposerProps,
} from "../index";

test("contextual presentation keeps its target and shared data types", () => {
  expectTypeOf<ItemComposerProps["target"]["week"]>().toEqualTypeOf<
    "current" | "next"
  >();
  expectTypeOf<
    ItemComposerProps["value"]["status"]
  >().toEqualTypeOf<ItemWorkflowStatus>();
  expectTypeOf<RiskComposerProps["target"]["kind"]>().toEqualTypeOf<"risk">();
  expectTypeOf<
    DecisionComposerProps["target"]["kind"]
  >().toEqualTypeOf<"decision">();
  expectTypeOf<CommentsViewProps["comments"]>().toEqualTypeOf<
    readonly RecordCommentView[]
  >();
});
