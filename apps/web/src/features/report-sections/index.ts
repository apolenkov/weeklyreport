export { FOREIGN_ENTRY_OPACITY } from "./model/item-card-style";
export type { ItemWorkflowStatus } from "./model/item-status";
export type {
  CrossAuthorContentRow,
  CrossAuthorRow,
} from "./model/lead-cross-author";
export {
  applyCrossAuthorStageOverrides,
  buildCrossAuthorStageMap,
  mapForeignDecisions,
  mapForeignItems,
  mapForeignRisks,
} from "./model/lead-cross-author";
export type {
  LeadActivityCard,
  LeadCurrentUser,
  LeadDecisionEntry,
  LeadKanbanItem,
  LeadReviewFeedbackRecord,
  LeadRiskEntry,
  MappedLeadForm,
} from "./model/lead-form";
export {
  mapLeadFormData,
  mapLeadProducts,
  mapLeadReviewFeedback,
  mapLeadRisks,
  normalizeStageName,
  ownedStagesForProject,
} from "./model/lead-form";
export type { HistoryEntry } from "./model/lead-history";
export { sectionToDraftPayload } from "./model/lead-section-draft-payload";
export type { LeadStatus } from "./model/lead-status";
export { deriveLeadStatus } from "./model/lead-status";
export type { LeadSubmitReadiness } from "./model/lead-submit-readiness";
export {
  buildLeadSubmitPayload,
  deriveLeadSubmitReadiness,
} from "./model/lead-submit-readiness";
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
export {
  mapWeeklyReport,
  mapWeeklyReportLeadGroups,
  mapWeeklyReportLeadOverview,
} from "./model/weekly-report";
export type {
  LeadOverviewRow,
  WeeklyPortfolioProduct,
  WeeklyProductReport,
  WeeklyProductStatus,
  WeeklyReportDecision,
  WeeklyReportItem,
  WeeklyReportRisk,
} from "./model/weekly-report-types";
export { ActivityLanesBlock } from "./ui/activity-lanes-block";
export { BoardColumnHeader } from "./ui/board-column-header";
export { BoardEmptyState } from "./ui/board-empty-state";
export { ItemCard } from "./ui/item-card";
export { PublishedRecordMarker } from "./ui/item-card-actions";
export { ItemEditDialog } from "./ui/item-edit-dialog";
export type { ParentActivityOption, RecordParent } from "./ui/product-picker";
export { ParentPicker } from "./ui/product-picker";
export { StageChip } from "./ui/stage-chip";
export { StageStep } from "./ui/stage-step";
