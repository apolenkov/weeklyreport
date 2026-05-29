/**
 * Barrel export for the api/presentation type-translation layer.
 *
 * These mappers bridge the semantic gap between Zod/Prisma API types
 * and the presentation-layer enums used by lead/dashboard components.
 * See `.planning/research/PITFALLS.md` (Pitfall 1) for context.
 */

export {
  type AdminProjectFormInput,
  type AdminReminderPolicyFormInput,
  type AdminReminderRuleFormInput,
  type AdminUserFormInput,
  type MappedAdminSnapshot,
  type MockGroup,
  type MockPeriod,
  type MockProduct,
  type MockReminder,
  type MockReminderPolicy,
  type MockSettings,
  type MockUser,
  mapAdminSettings,
  mapAdminSnapshot,
  type PeriodStatus,
  type ReportingGroupFormInput,
  type ReportPeriodFormInput,
  type StageAssignment,
  type StageName,
  toAdminProjectInput,
  toAdminReminderRuleInput,
  toAdminUserInput,
  toReminderPolicyInput,
  toReportingGroupInput,
  toReportPeriodInput,
  type UserRole,
} from "./admin";
export {
  type ArchiveReport,
  type BlockedAtRiskItem,
  formatRelativeDeadline,
  type KpiData,
  type LeadInfo,
  type MapDashboardArgs,
  type MappedDashboard,
  mapArchiveSummary,
  mapDashboardData,
  type ProductStatus,
  type TrafficLight,
} from "./dashboard";
export {
  deriveItemStatus,
  type ItemStatus,
  type ItemType,
  type ItemWorkflowStatus,
  itemStatusToWorkflow,
  workflowToItemStatus,
} from "./item-status";
export {
  type LeadCurrentUser,
  type LeadDecisionEntry,
  type LeadKanbanItem,
  type LeadPriorityEntry,
  type LeadProduct,
  type LeadReportPeriod,
  type LeadRiskEntry,
  type LeadStageAssignment,
  type LeadStageOwnership,
  type LeadVersionSnapshot,
  type MapLeadFormArgs,
  type MappedLeadForm,
  mapLeadDecisions,
  mapLeadFormData,
  mapLeadItems,
  mapLeadPeriods,
  mapLeadPriorities,
  mapLeadProducts,
  mapLeadRisks,
  mapLeadVersions,
} from "./lead-form";
export {
  formatDateRange,
  formatSubmittedAt,
  type HistoryEntry,
  isoWeekNumber,
  mapCompiledHistoryEntries,
  mapHistoryEntries,
} from "./lead-history";
export {
  deriveLeadStatus,
  type LeadStatus,
  type ReportSectionStatus,
} from "./lead-status";
export {
  type StageStatus,
  stageStatusToTraffic,
  type TrafficLightStatus,
  trafficToStageStatus,
} from "./traffic-light";

export {
  formatWeekRange,
  type MapWeeklyReportResult,
  mapWeeklyReport,
  type WeeklyPortfolioProduct,
  type WeeklyProductReport,
  type WeeklyProductStatus,
  type WeeklyReportDecision,
  type WeeklyReportItem,
  type WeeklyReportPeriod,
  type WeeklyReportPriority,
  type WeeklyReportRisk,
} from "./weekly-report";
