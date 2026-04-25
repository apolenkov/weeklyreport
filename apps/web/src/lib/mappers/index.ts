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
} from './traffic-light';

export {
  workflowToItemStatus,
  itemStatusToWorkflow,
  deriveItemStatus,
  type ItemWorkflowStatus,
  type ItemType,
  type ItemStatus,
} from './item-status';

export {
  deriveLeadStatus,
  type ReportSectionStatus,
  type LeadStatus,
} from './lead-status';

export {
  mapHistoryEntries,
  formatDateRange,
  formatSubmittedAt,
  isoWeekNumber,
  type HistoryEntry,
} from './lead-history';
