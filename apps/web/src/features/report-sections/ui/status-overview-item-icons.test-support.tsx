import type { RecordCommentView } from "@weeklyreport/shared";

import type { StatusOverviewItem } from "../model/status-overview";

const item: StatusOverviewItem = {
  key: "item-1",
  recordId: "item-1",
  source: "current",
  editTarget: { recordId: "item-1", source: "current" },
  stableId: "stable-1",
  text: "Original text",
  tag: "feature",
  stageNames: ["Development"],
  pausedReason: null,
  resolution: null,
  outcomeHistory: [],
  comments: [],
  canResolve: false,
  canRestore: false,
  workflowStatus: "in_progress",
  continuity: "continued",
};

const nextItem: StatusOverviewItem = {
  ...item,
  source: "next",
  workflowStatus: "planned",
  editTarget: { recordId: "item-1", source: "next" },
  continuity: null,
};

const projection: StatusOverviewItem = {
  ...nextItem,
  editTarget: { recordId: "item-1", source: "current", focusNextStep: true },
};

const previousItem: StatusOverviewItem = {
  ...item,
  source: "previous",
  editTarget: null,
  continuity: null,
};

const COMMENT: RecordCommentView = {
  id: "33333333-3333-4333-8333-333333333333",
  reviewerId: "22222222-2222-4222-8222-222222222222",
  reviewerName: "Head Reviewer",
  text: "Please split this item.",
  createdAt: new Date("2026-07-01T10:00:00Z"),
};

function focusCard(): void {
  const card = document.querySelector<HTMLElement>(
    "[data-overview-item-preview]",
  );
  card?.focus();
}
export { COMMENT, focusCard, item, nextItem, previousItem, projection };
