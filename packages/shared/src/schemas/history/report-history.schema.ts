import { z } from "zod";

import {
  reportDate,
  reportSectionStatusSchema,
  reportStatusSchema,
  trafficLightStatusSchema,
} from "../primitives/report-primitives.schema.js";
import { assembledReportSchema } from "../report/report.schema.js";

const MAX_PAGE_SIZE = 100;

/** Carry-over execution states exposed by history APIs. */
export const carryOverStatusSchema = z.enum(["completed"]);

/** Validates lineage for one carried item or decision. */
export const carryOverRecordSchema = z
  .object({
    id: z.uuid(),
    sourceReportId: z.uuid(),
    targetReportId: z.uuid(),
    sourceItemId: z.uuid().nullable(),
    targetItemId: z.uuid().nullable(),
    sourceDecisionId: z.uuid().nullable(),
    targetDecisionId: z.uuid().nullable(),
    status: carryOverStatusSchema,
    carriedAt: z.coerce.date(),
  })
  .readonly();

/** Validates aggregate counts for one idempotent carry-over execution. */
export const carryOverExecutionSchema = z
  .object({
    id: z.uuid(),
    sourceReportId: z.uuid(),
    targetReportId: z.uuid(),
    dedupeKey: z.string().min(1),
    status: carryOverStatusSchema,
    startedAt: z.coerce.date(),
    completedAt: z.coerce.date(),
    carriedItemCount: z.number().int().min(0),
    carriedDecisionCount: z.number().int().min(0),
  })
  .readonly();

/** Validates the compact metadata shown in archive lists. */
export const archiveReportSummarySchema = z
  .object({
    reportId: z.uuid(),
    periodStart: reportDate(),
    periodEnd: reportDate(),
    publishedAt: reportDate(),
    publishedByName: z.string().min(1),
    portfolioStatus: trafficLightStatusSchema,
  })
  .readonly();

/** Validates an archived report together with its list summary. */
export const archiveReportDetailSchema = z
  .object({
    summary: archiveReportSummarySchema,
    report: assembledReportSchema.readonly(),
  })
  .readonly();

/** Validates whether compiled history includes archived periods. */
export const compiledHistoryInputSchema = z
  .object({
    includeArchive: z.boolean().optional(),
  })
  .readonly();

/** Validates aggregate counts for one completed reporting period. */
export const compiledHistoryEntrySchema = z
  .object({
    reportId: z.uuid(),
    periodStart: reportDate(),
    periodEnd: reportDate(),
    publishedAt: z.coerce.date().nullable(),
    archived: z.boolean(),
    // The period is live again after a reopen; the counts below still describe
    // the last publication.
    reopened: z.boolean(),
    publishedByName: z.string().min(1),
    trafficLights: z
      .object({
        green: z.number().int().min(0),
        yellow: z.number().int().min(0),
        red: z.number().int().min(0),
      })
      .readonly(),
    itemCount: z.number().int().min(0),
    riskCount: z.number().int().min(0),
    decisionCount: z.number().int().min(0),
    priorityCount: z.number().int().min(0),
    sectionCount: z.number().int().min(0),
    productCount: z.number().int().min(0),
  })
  .readonly();

/** Validates compiled history entries and the separate archive count. */
export const compiledHistoryResultSchema = z
  .object({
    entries: z.array(compiledHistoryEntrySchema).readonly(),
    archiveCount: z.number().int().min(0),
  })
  .readonly();

/** Validates one lead's period history entry and optional aggregate details. */
export const myHistoryEntrySchema = z
  .object({
    sectionId: z.uuid(),
    reportId: z.uuid(),
    periodStart: z.coerce.date(),
    periodEnd: z.coerce.date(),
    reportStatus: reportStatusSchema,
    sectionStatus: reportSectionStatusSchema,
    archived: z.boolean().optional(),
    // The period is live again after a reopen; publishedAt still names the
    // last publication.
    reopened: z.boolean().optional(),
    submittedAt: z.coerce.date().nullable(),
    publishedAt: z.coerce.date().nullable(),
    createdAt: z.coerce.date().optional(),
    updatedAt: z.coerce.date().optional(),
    lastEditAt: z.coerce.date().nullable().optional(),
    itemCount: z.number().int().min(0).optional(),
    riskCount: z.number().int().min(0).optional(),
    decisionCount: z.number().int().min(0).optional(),
    priorityCount: z.number().int().min(0).optional(),
    productCount: z.number().int().min(0).optional(),
    trafficLights: z
      .object({
        green: z.number().int().min(0),
        yellow: z.number().int().min(0),
        red: z.number().int().min(0),
      })
      .readonly()
      .optional(),
  })
  .readonly();

/** Validates a bounded page request with an opaque cursor. */
export const paginationInputSchema = z
  .object({
    // Opaque pagination token: a row id for the log / reminder lists, an encoded
    // keyset coordinate for the archive. Validated only as a non-empty string so
    // no single consumer's cursor shape is baked into the shared contract.
    cursor: z.string().min(1).optional(),
    limit: z.number().int().min(1).max(MAX_PAGE_SIZE),
  })
  .readonly();

/** Page of results with an opaque continuation cursor. */
export interface PaginatedResult<T> {
  readonly items: readonly T[];
  readonly nextCursor: string | null;
}

/** Source-to-target lineage for one carried item or decision. */
export type CarryOverRecord = z.infer<typeof carryOverRecordSchema>;
/** Idempotent carry-over outcome with aggregate copy counts. */
export type CarryOverExecution = z.infer<typeof carryOverExecutionSchema>;
/** Report identity, period, publication, archive state, and list counts. */
export type ArchiveReportSummary = z.infer<typeof archiveReportSummarySchema>;
/** Archived assembled report paired with its list summary. */
export type ArchiveReportDetail = z.infer<typeof archiveReportDetailSchema>;
/** Completed-period aggregates and per-status traffic-light totals. */
export type CompiledHistoryEntry = z.infer<typeof compiledHistoryEntrySchema>;
/** Ordered compiled-history entries plus the independent archive count. */
export type CompiledHistoryResult = z.infer<typeof compiledHistoryResultSchema>;
/** Lead-specific period result with optional aggregate details. */
export type MyHistoryEntry = z.infer<typeof myHistoryEntrySchema>;
/**
 * A bounded page of lead-specific history entries.
 * @public
 */
export const myHistoryResultSchema = z
  .object({
    items: myHistoryEntrySchema.array().readonly(),
    nextCursor: z.string().min(1).nullable(),
  })
  .readonly();
/** Bounded lead-specific history page. */
export type MyHistoryResult = z.infer<typeof myHistoryResultSchema>;
/** Bounded cursor-page request. */
export type PaginationInput = z.infer<typeof paginationInputSchema>;
