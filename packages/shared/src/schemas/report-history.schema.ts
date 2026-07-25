import { z } from "zod";

import { assembledReportSchema } from "./report.schema";
import {
  reportDate,
  reportSectionStatusSchema,
  reportStatusSchema,
  trafficLightStatusSchema,
} from "./report-primitives.schema";

const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 20;

export const carryOverStatusSchema = z.enum(["completed"]);

export const carryOverRecordSchema = z.object({
  id: z.uuid(),
  sourceReportId: z.uuid(),
  targetReportId: z.uuid(),
  sourceItemId: z.uuid().nullable(),
  targetItemId: z.uuid().nullable(),
  sourceDecisionId: z.uuid().nullable(),
  targetDecisionId: z.uuid().nullable(),
  status: carryOverStatusSchema,
  carriedAt: z.coerce.date(),
});

export const carryOverExecutionSchema = z.object({
  id: z.uuid(),
  sourceReportId: z.uuid(),
  targetReportId: z.uuid(),
  dedupeKey: z.string().min(1),
  status: carryOverStatusSchema,
  startedAt: z.coerce.date(),
  completedAt: z.coerce.date(),
  carriedItemCount: z.number().int().min(0),
  carriedDecisionCount: z.number().int().min(0),
});

export const archiveReportSummarySchema = z.object({
  reportId: z.uuid(),
  periodStart: reportDate(),
  periodEnd: reportDate(),
  publishedAt: reportDate(),
  publishedByName: z.string().min(1),
  portfolioStatus: trafficLightStatusSchema,
});

export const archiveReportDetailSchema = z.object({
  summary: archiveReportSummarySchema,
  report: assembledReportSchema,
});

export const compiledHistoryInputSchema = z.object({
  includeArchive: z.boolean().optional(),
});

export const compiledHistoryEntrySchema = z.object({
  reportId: z.uuid(),
  periodStart: reportDate(),
  periodEnd: reportDate(),
  publishedAt: z.coerce.date().nullable(),
  archived: z.boolean(),
  publishedByName: z.string().min(1),
  trafficLights: z.object({
    green: z.number().int().min(0),
    yellow: z.number().int().min(0),
    red: z.number().int().min(0),
  }),
  itemCount: z.number().int().min(0),
  riskCount: z.number().int().min(0),
  decisionCount: z.number().int().min(0),
  priorityCount: z.number().int().min(0),
  sectionCount: z.number().int().min(0),
  productCount: z.number().int().min(0),
});

export const compiledHistoryResultSchema = z.object({
  entries: z.array(compiledHistoryEntrySchema),
  archiveCount: z.number().int().min(0),
});

export const myHistoryEntrySchema = z.object({
  sectionId: z.uuid(),
  reportId: z.uuid(),
  periodStart: z.coerce.date(),
  periodEnd: z.coerce.date(),
  reportStatus: reportStatusSchema,
  sectionStatus: reportSectionStatusSchema,
  archived: z.boolean().optional(),
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
    .optional(),
});

// ---------------------------------------------------------------------------
// Pagination
// ---------------------------------------------------------------------------

export const paginationInputSchema = z.object({
  // Opaque pagination token: a row id for the log / reminder lists, an encoded
  // keyset coordinate for the archive. Validated only as a non-empty string so
  // no single consumer's cursor shape is baked into the shared contract.
  cursor: z.string().min(1).optional(),
  limit: z.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
});

export interface PaginatedResult<T> {
  items: T[];
  nextCursor: string | null;
}

// ---------------------------------------------------------------------------
// Type exports
// ---------------------------------------------------------------------------

export type CarryOverRecord = z.infer<typeof carryOverRecordSchema>;
export type CarryOverExecution = z.infer<typeof carryOverExecutionSchema>;
export type ArchiveReportSummary = z.infer<typeof archiveReportSummarySchema>;
export type ArchiveReportDetail = z.infer<typeof archiveReportDetailSchema>;
export type CompiledHistoryInput = z.infer<typeof compiledHistoryInputSchema>;
export type CompiledHistoryEntry = z.infer<typeof compiledHistoryEntrySchema>;
export type CompiledHistoryResult = z.infer<typeof compiledHistoryResultSchema>;
export type MyHistoryEntry = z.infer<typeof myHistoryEntrySchema>;
export type PaginationInput = z.infer<typeof paginationInputSchema>;
