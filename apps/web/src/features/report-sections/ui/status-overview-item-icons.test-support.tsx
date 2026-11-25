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

function focusCard(): void {
  const card = document.querySelector<HTMLElement>(
    "[data-overview-item-preview]",
  );
  card?.focus();
}
export { focusCard, item, nextItem, previousItem, projection };
