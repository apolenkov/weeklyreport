import type { SelectableReportSource } from "../domain/period-source-selection.js";
import type { ReportOccurrence } from "../domain/report-retrieval.types.js";

export interface ReportSearchAccessRepository {
  hasOwnSection(reportId: string, actorId: string): Promise<boolean>;
  getSharedNonArchivedProductIds(
    actorId: string,
    authorId: string,
  ): Promise<readonly string[]>;
}

/**
 * Application port for canonical report content used by the assistant.
 *
 * The port deliberately exposes read models and occurrences only. It has no
 * write method and does not represent a SearchDocument projection: report
 * saves remain independent from assistant retrieval and indexing.
 */
export interface ReportSearchRepository extends ReportSearchAccessRepository {
  listSources(): Promise<readonly SelectableReportSource[]>;
  loadOccurrences(
    sources: readonly SelectableReportSource[],
  ): Promise<readonly ReportOccurrence[]>;
}
