import { type SearchPlan } from "@customreport/shared";
import type { PrismaClient } from "@prisma/client";

import { authorizeReportOccurrences } from "../src/modules/search/application/authorized-report-retrieval.js";
import {
  type SelectableReportSource,
  selectPeriodSources,
} from "../src/modules/search/domain/period-source-selection.js";
import type { ReportOccurrence } from "../src/modules/search/domain/report-retrieval.types.js";
import { ReportSearchPrismaRepository } from "../src/modules/search/infrastructure/report-search.prisma-repository.js";
import {
  assertPrimarySections,
  assertPublishedSnapshots,
  assertSelectedSources,
  type AssistantReadinessDigestEntry,
  type AssistantReadinessOptions,
  digestSource,
} from "./seed-assistant-readiness.validation.js";

export type {
  AssistantReadinessDigestEntry,
  AssistantReadinessOptions,
} from "./seed-assistant-readiness.validation.js";

const PERIOD_INTENT = {
  periods: {
    includeCurrent: true,
    published: { mode: "all" as const, count: null, references: [] },
  },
} satisfies Pick<SearchPlan, "periods">;

function digestSelectedSources(
  selected: readonly SelectableReportSource[],
  occurrences: ReadonlyMap<string, ReportOccurrence>,
  authorized: {
    readonly occurrences: readonly ReportOccurrence[];
    readonly sectionScopes: Parameters<typeof digestSource>[2]["scopes"];
  },
  options: AssistantReadinessOptions,
): readonly AssistantReadinessDigestEntry[] {
  const seen = new Set<string>();
  return selected.flatMap((source) => {
    const occurrence = occurrences.get(source.reportId);
    return occurrence === undefined
      ? []
      : digestSource(source, occurrence, {
          authorizedOccurrences: authorized.occurrences,
          scopes: authorized.sectionScopes,
          options,
          seen,
        });
  });
}

/**
 * Proves that the seeded primary lead can retrieve every advertised source
 * through the production repository, mapper, authorization and projector.
 */
export async function assertAssistantReadiness(
  prisma: PrismaClient,
  options: AssistantReadinessOptions,
): Promise<readonly AssistantReadinessDigestEntry[]> {
  await assertPublishedSnapshots(prisma, options);
  const repository = new ReportSearchPrismaRepository(prisma as never);
  const sources = await repository.listSources({ publishedMode: "all" });
  const selected = selectPeriodSources(sources, PERIOD_INTENT, options.now);
  assertSelectedSources(selected, options);
  const occurrences = await repository.loadOccurrences(selected);
  const occurrenceByReportId = assertPrimarySections(
    selected,
    occurrences,
    options,
  );
  const authorized = await authorizeReportOccurrences(
    repository,
    options.actorId,
    occurrences,
  );
  return digestSelectedSources(
    selected,
    occurrenceByReportId,
    authorized,
    options,
  ).toSorted(
    (a, b) =>
      a.occurrenceId.localeCompare(b.occurrenceId) ||
      a.kind.localeCompare(b.kind),
  );
}
