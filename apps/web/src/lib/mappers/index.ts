/**
 * Barrel export for the api/presentation type-translation layer.
 *
 * These mappers bridge the semantic gap between Zod/Prisma API types
 * and the presentation-layer enums used by lead/dashboard components.
 * See `.planning/research/PITFALLS.md` (Pitfall 1) for context.
 */

export {
  trafficToStageStatus,
  stageStatusToTraffic,
  type TrafficLightStatus,
  type StageStatus,
} from "./traffic-light";

export {
  workflowToItemStatus,
  itemStatusToWorkflow,
  deriveItemStatus,
  type ItemWorkflowStatus,
  type ItemType,
  type ItemStatus,
} from "./item-status";

export {
  deriveLeadStatus,
  type ReportSectionStatus,
  type LeadStatus,
} from "./lead-status";

export {
  mapHistoryEntries,
  formatDateRange,
  formatSubmittedAt,
  isoWeekNumber,
  type HistoryEntry,
} from "./lead-history";

export {
  mapAdminSnapshot,
  mapAdminSettings,
  toAdminUserInput,
  toReportingGroupInput,
  toAdminProjectInput,
  toReportPeriodInput,
  toAdminReminderRuleInput,
  type MockUser,
  type MockGroup,
  type MockProduct,
  type MockPeriod,
  type MockReminder,
  type MockSettings,
  type MappedAdminSnapshot,
  type StageName,
  type StageAssignment,
  type PeriodStatus,
  type UserRole,
  type AdminUserFormInput,
  type ReportingGroupFormInput,
  type AdminProjectFormInput,
  type ReportPeriodFormInput,
  type AdminReminderRuleFormInput,
} from "./admin";

export {
  mapDashboardData,
  mapArchiveSummary,
  formatRelativeDeadline,
  type KpiData,
  type LeadInfo,
  type BlockedAtRiskItem,
  type ArchiveReport,
  type ProductStatus,
  type TrafficLight,
  type MapDashboardArgs,
  type MappedDashboard,
} from "./dashboard";

export {
  mapLeadFormData,
  mapLeadProducts,
  mapLeadItems,
  mapLeadRisks,
  mapLeadDecisions,
  mapLeadPriorities,
  mapLeadPeriods,
  mapLeadVersions,
  type LeadProduct,
  type LeadStageAssignment,
  type LeadStageOwnership,
  type LeadKanbanItem,
  type LeadRiskEntry,
  type LeadDecisionEntry,
  type LeadPriorityEntry,
  type LeadReportPeriod,
  type LeadVersionSnapshot,
  type LeadCurrentUser,
  type MapLeadFormArgs,
  type MappedLeadForm,
} from "./lead-form";

export {
  mapWeeklyReport,
  formatWeekRange,
  type WeeklyProductStatus,
  type WeeklyPortfolioProduct,
  type WeeklyReportItem,
  type WeeklyReportRisk,
  type WeeklyReportDecision,
  type WeeklyReportPriority,
  type WeeklyProductReport,
  type WeeklyReportPeriod,
  type MapWeeklyReportResult,
} from "./weekly-report";
