import type { SelectableReportSource } from "../domain/period-source-selection.js";
import type { ReportOccurrence } from "../domain/report-retrieval.types.js";

export type ReportSourceOptions = Readonly<{
  readonly publishedMode?: "latest" | "all" | "named" | "none";
  readonly publishedCount?: number;
  readonly publishedLabels?: readonly string[];
}>;

export class ReportSearchResultSetTooLargeError extends Error {
  readonly code = "result_set_too_large" as const;
  constructor() {
    super("Published report result set exceeds the configured safety cap.");
    this.name = "ReportSearchResultSetTooLargeError";
  }
}

export interface ReportSearchAccessRepository {
  /** Reads report access and product sharing from one repeatable-read snapshot. */
  getAuthorizationSnapshot(
    actorId: string,
    reportIds: readonly string[],
    authorIds: readonly string[],
  ): Promise<{
    readonly ownSectionReportIds: readonly string[];
    readonly sharedProductIdsByAuthor: ReadonlyMap<string, readonly string[]>;
  }>;
}

/**
 * Application port for canonical report content used by the assistant.
 *
 * The port deliberately exposes read models and occurrences only. It has no
 * write method and does not represent a SearchDocument projection: report
 * saves remain independent from assistant retrieval and indexing.
 */
export interface ReportSearchRepository extends ReportSearchAccessRepository {
  /** Reads the database-enforced generation of all semantic source rows. */
  getSourceGeneration(): Promise<bigint>;
  listSources(
    options?: ReportSourceOptions,
  ): Promise<readonly SelectableReportSource[]>;
  loadOccurrences(
    sources: readonly SelectableReportSource[],
  ): Promise<readonly ReportOccurrence[]>;
}
