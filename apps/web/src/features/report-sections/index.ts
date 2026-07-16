export { FOREIGN_ENTRY_OPACITY } from "./model/item-card-style";
export type { CrossAuthorContentRow } from "./model/lead-cross-author";
export type {
  LeadActivityCard,
  LeadDecisionEntry,
  LeadKanbanItem,
  LeadReviewFeedbackRecord,
  LeadRiskEntry,
  MappedLeadForm,
} from "./model/lead-form";
export { mapLeadFormData, mapLeadReviewFeedback } from "./model/lead-form";
export type { HistoryEntry } from "./model/lead-history";
export type { LeadStatus } from "./model/lead-status";
export { deriveLeadStatus } from "./model/lead-status";
export { MOCK_PRODUCTS } from "./model/mock-data";
export { isBoardEmpty, splitItemBoard } from "./model/next-week-columns";
export { resolveRecordParent } from "./model/record-parent";
export { reportHasContent } from "./model/report-content";
export {
  STAGE_CHIP_BOX_HEIGHT,
  STAGE_ICONS,
  STATUS_CONFIG,
} from "./model/stage-chip-config";
export {
  computeEffectiveStageIds,
  isZeroOwnedStageDeadEnd,
} from "./model/stage-ownership";
export {
  canonicalStageIds,
  canonicalStageName,
  riskCoversStage,
  splitStageNames,
} from "./model/stage-tags";
export {
  stageStatusToTraffic,
  trafficToStageStatus,
} from "./model/traffic-light";
export type {
  DecisionEntry,
  KanbanItem,
  Product,
  ReportPeriod,
  RiskEntry,
  StageAssignment,
  StageStatus,
} from "./model/types";
export { mapWeeklyReport } from "./model/weekly-report";
export { ActivityLanesBlock } from "./ui/activity-lanes-block";
export { BoardColumnHeader } from "./ui/board-column-header";
export { BoardEmptyState } from "./ui/board-empty-state";
export { ItemCard } from "./ui/item-card";
export { ItemEditDialog } from "./ui/item-edit-dialog";
export type { ParentActivityOption, RecordParent } from "./ui/product-picker";
export { ParentPicker } from "./ui/product-picker";
export { StageChip } from "./ui/stage-chip";
export { StageMultiSelect } from "./ui/stage-multi-select";
export { StageStep } from "./ui/stage-step";
export { useSlideInlineEditor } from "./ui/use-slide-inline-editor";
export { WeeklyReportPage } from "./ui/weekly-report-page";
export { WeeklyReportSkeleton } from "./ui/weekly-report-skeleton";
