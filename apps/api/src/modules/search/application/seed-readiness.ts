import type { SearchPlan } from "@customreport/shared";

import { projectSectionCandidates } from "../domain/candidate-projector.js";
import { selectPeriodSources } from "../domain/period-source-selection.js";
import type {
  ReportOccurrence,
  SearchCandidate,
} from "../domain/report-retrieval.types.js";
import { authorizeReportOccurrences } from "./authorized-report-retrieval.js";
import type { ReportSearchRepository } from "./report-search.repository.js";

const currentIntent: Pick<SearchPlan, "periods"> = {
  periods: {
    includeCurrent: true,
    published: { mode: "none", count: null, references: [] },
  },
};

export type SeedReadinessInput = Readonly<{
  actorId: string;
  label: string;
  now: Date;
  publishedReportIds: readonly string[];
}>;

export type SeedReadinessSummary = Readonly<{
  currentReportIds: readonly string[];
  publishedReportIds: readonly string[];
  candidateCount: number;
}>;

class SeedReadinessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SeedReadinessError";
  }
}

const fail = (
  input: SeedReadinessInput,
  stage: string,
  reportId: string,
  detail: string,
): never => {
  throw new SeedReadinessError(
    `[${input.label}] assistant readiness failed at ${stage} for report ${reportId}: ${detail}`,
  );
};

const sourceByReport = (
  input: SeedReadinessInput,
  reportIds: readonly string[],
  sources: Awaited<ReturnType<ReportSearchRepository["listSources"]>>,
) =>
  reportIds.map((reportId) => {
    const source = sources.find((candidate) => candidate.reportId === reportId);
    return source ?? fail(input, "published_snapshot", reportId, "missing");
  });

const candidatesForSource = async (
  repository: ReportSearchRepository,
  input: SeedReadinessInput,
  source: Awaited<ReturnType<ReportSearchRepository["listSources"]>>[number],
): Promise<readonly SearchCandidate[]> => {
  const occurrences = await (async (): Promise<readonly ReportOccurrence[]> => {
    try {
      return await repository.loadOccurrences([source]);
    } catch {
      return fail(
        input,
        "published_snapshot",
        source.reportId,
        "invalid or unreadable",
      );
    }
  })();
  const authorized = await (async () => {
    try {
      return await authorizeReportOccurrences(
        repository,
        input.actorId,
        occurrences,
      );
    } catch {
      return fail(input, "authorization", source.reportId, "failed");
    }
  })();

  if (
    !authorized.sectionScopes.some(
      (scope) => scope.reportId === source.reportId,
    )
  ) {
    fail(input, "caller_section", source.reportId, "missing");
  }

  const occurrence = authorized.occurrences.find(
    (candidate) => candidate.reportId === source.reportId,
  );
  const candidates = occurrence
    ? authorized.sectionScopes
        .filter((scope) => scope.reportId === source.reportId)
        .flatMap((scope) => projectSectionCandidates(occurrence, scope))
    : [];
  if (candidates.length === 0) {
    fail(input, "candidate_projection", source.reportId, "empty");
  }
  return candidates;
};

const latestFutureStart = (
  sources: Awaited<ReturnType<ReportSearchRepository["listSources"]>>,
  now: Date,
): Date | null => {
  const future = sources
    .filter((source) => source.source === "live" && source.periodStart >= now)
    .map((source) => source.periodStart.getTime());
  const latest = Math.max(...future);
  return Number.isFinite(latest) ? new Date(latest) : null;
};

const assertUniqueOccurrences = (
  input: SeedReadinessInput,
  candidates: readonly SearchCandidate[],
): void => {
  const identities = candidates.map(({ identity }) => identity.occurrenceId);
  const duplicates = identities.filter(
    (identity, index) => identities.indexOf(identity) !== index,
  );
  if (duplicates.length > 0) {
    fail(input, "occurrence_identity", duplicates[0] ?? "unknown", "duplicate");
  }
};

export async function assertSeedAssistantReadiness(
  repository: ReportSearchRepository,
  input: SeedReadinessInput,
): Promise<SeedReadinessSummary> {
  const sources = await repository.listSources();
  const clocks = [input.now, latestFutureStart(sources, input.now)].filter(
    (clock): clock is Date => clock !== null,
  );
  const currentClocks = [
    ...new Map(clocks.map((clock) => [clock.getTime(), clock])).values(),
  ];
  const currentSources = currentClocks.map((clock) => {
    const selected = selectPeriodSources(sources, currentIntent, clock);
    return selected[0] ?? fail(input, "current_source", "none", "missing");
  });
  const publishedSources = sourceByReport(
    input,
    input.publishedReportIds,
    sources,
  );
  const allSources = [...currentSources, ...publishedSources];
  const candidates = (
    await Promise.all(
      allSources.map((source) =>
        candidatesForSource(repository, input, source),
      ),
    )
  ).flat();
  assertUniqueOccurrences(input, candidates);

  return {
    currentReportIds: currentSources.map(({ reportId }) => reportId),
    publishedReportIds: publishedSources.map(({ reportId }) => reportId),
    candidateCount: candidates.length,
  };
}
