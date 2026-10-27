export { crossAuthorContentFetchEnabled } from "./model/cross-author/cross-author-content-gate";
export type { DraftStageMemory } from "./model/draft-stage-memory";
export { createDraftStageMemory } from "./model/draft-stage-memory";
export { STATUS_BADGE } from "./model/item-card-style";
export { buildItemDialogProps } from "./model/item-dialog-props";
export { persistableItemStatusToWorkflow } from "./model/item-status";
export {
  buildConfirmAllCarriedPatch,
  buildConfirmCarriedItemPatch,
  buildMoveItemPatch,
  buildNextWeekPlanAcknowledgementPatch,
  isSavedNextWeekPlan,
  promoteContinuationPatch,
} from "./model/lead-actions/lead-item-actions";
export {
  buildSetItemStatusPatch,
  type ItemStatusInput,
  itemStatusRiskText,
} from "./model/lead-actions/lead-item-status-patch";
export type { CrossAuthorRow } from "./model/lead-cross-author";
export type { CrossAuthorContentRow } from "./model/lead-cross-author-content";
export type {
  LeadActivityCard,
  LeadDecisionEntry,
  LeadKanbanItem,
  LeadReviewFeedbackRecord,
  LeadRiskEntry,
  MappedLeadForm,
} from "./model/lead-form";
export {
  mapLeadFormData,
  mapLeadItems,
  mapLeadReviewFeedback,
  ownedStagesForProject,
} from "./model/lead-form";
export type { DraftPatch } from "./model/lead-form/draft/lead-form-draft-patch";
export type { LeadFormGeneration } from "./model/lead-form/lead-form-generation";
export { leadFormGenerationOf } from "./model/lead-form/lead-form-generation";
export type {
  LeadFormLoadedInput,
  LeadFormLoadedViewModel,
} from "./model/lead-form/lead-form-loaded-view-model";
export { buildLeadFormLoadedViewModel } from "./model/lead-form/lead-form-loaded-view-model";
export type {
  LeadFormLoadedContext,
  SubmitOutcome,
} from "./model/lead-form/lead-form-submit-context";
export { leadPeriodLabel } from "./model/lead-form/lead-period-label";
export type { RiskPrefillRequest } from "./model/lead-form/risk-prefill";
export type { HistoryEntry } from "./model/lead-history";
export {
  mapCompiledHistoryEntries,
  mapHistoryEntries,
} from "./model/lead-history";
export { sectionToDraftPayload } from "./model/lead-section-draft-payload";
export type { LeadStatus } from "./model/lead-status";
export { deriveLeadStatus } from "./model/lead-status";
export type { LeadSubmitReadiness } from "./model/lead-submit-readiness";
export { pendingReviewLabel } from "./model/lead-submit-readiness";
export { isBoardEmpty, splitItemBoard } from "./model/next-week-columns";
export { sortByPriorityRank } from "./model/priority/priority-sort";
export type { ParentActivityOption, RecordParent } from "./model/record-parent";
export { resolveRecordParent } from "./model/record-parent";
export { reportHasContent } from "./model/report-content";
export { projectReportHealthPulse } from "./model/report-health-pulse";
export { toNavigationPeriod } from "./model/report-period";
export {
  STAGE_CHIP_BOX_HEIGHT,
  STAGE_ICONS,
  STATUS_CONFIG,
} from "./model/stage-chip-config";
export {
  computeEffectiveStageNames,
  isZeroOwnedStageDeadEnd,
  resolveInitialStageNames,
} from "./model/stage-ownership";
export { canonicalStageNames, riskCoversStage } from "./model/stage-tags";
export type {
  StatusOverviewCreateTarget,
  StatusOverviewEditTarget,
  StatusOverviewItem,
  StatusOverviewModel,
} from "./model/status-overview";
export { projectStatusOverview } from "./model/status-overview";
export type { PlanVerdict } from "./model/status-overview-verdict";
export { planVerdictWrite } from "./model/status-overview-verdict";
export {
  annotateOwnRiskCoverage,
  applyRiskSeverityFloor,
  coveringRisksForStage,
} from "./model/status-risk/lead-form-risk-coverage";
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
  MapWeeklyReportResult,
  WeeklyPortfolioProduct,
  WeeklyProductReport,
  WeeklyProductStatus,
  WeeklyReportDecision,
  WeeklyReportItem,
  WeeklyReportRisk,
} from "./model/weekly-report-types";
export { ActivityStatusStrip } from "./ui/activity/activity-status-strip";
export { UnifiedActivitySection } from "./ui/activity/unified-activity-section";
export { BoardEmptyState } from "./ui/board-empty-state";
export { BoardGrid } from "./ui/board-grid";
export {
  DraftStageMemoryProvider,
  DraftStageMemoryScopeProvider,
  useDraftStageMemory,
} from "./ui/draft-stage-memory-context";
export { ItemCard } from "./ui/item-card";
export { PublishedRecordMarker } from "./ui/item-card-actions";
export { ItemDialogStack } from "./ui/item-dialog-stack";
export { ItemEditDialog } from "./ui/item-edit-dialog";
export { resolveSaveProduct } from "./ui/item-edit-dialog-helpers";
export {
  createItemEditDraftStore,
  type ItemEditDraftStore,
} from "./ui/item-edit-draft-store";
export { ItemInlineEditor } from "./ui/item-inline-editor";
export { NextWeekSection } from "./ui/next-week/next-week-section";
export { ParentPicker } from "./ui/parent-picker";
export { PortfolioOverviewTable } from "./ui/portfolio/portfolio-overview-table";
export { StageChip } from "./ui/stage-chip";
export { StageStep } from "./ui/stage-step";
export { StatusOverview } from "./ui/status-overview";
export type { StatusOverviewEditorSlot } from "./ui/status-overview-editor-slot";
