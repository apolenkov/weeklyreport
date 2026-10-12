import type { ClarificationOption, SearchPlan } from "@weeklyreport/shared";

import { filterCandidates } from "../domain/candidate-filter.js";
import { projectSectionCandidates } from "../domain/candidate-projector.js";
import { resolveSearchPlanEntities } from "../domain/entity-resolver.plan.js";
import type { ResolveSearchPlanInput } from "../domain/entity-resolver.types.js";
import type { SelectableReportSource } from "../domain/period-source-selection.js";
import { selectPeriodSources } from "../domain/period-source-selection.js";
import type {
  ReportOccurrence,
  ResolvedSearchPlan,
  SearchCandidate,
} from "../domain/report-retrieval.types.js";
import { authorizeReportOccurrences } from "./authorized-report-retrieval.js";
import { buildReportAssistantEntityCatalog } from "./report-assistant.catalog.js";
import {
  type ReportSearchRepository,
  ReportSearchResultSetTooLargeError,
} from "./report-search.repository.js";

type RetrievalClock = Readonly<{ now: Date }>;

type CandidateResolutionContext = Pick<
  ResolveSearchPlanInput,
  "actorId" | "resolutionTokens" | "tokenCodec"
> &
  Readonly<{ clock: RetrievalClock; timeZone: string }>;

export type CandidateResolution =
  | Readonly<{
      kind: "resolved";
      plan: ResolvedSearchPlan;
      candidates: readonly SearchCandidate[];
    }>
  | Readonly<{
      kind: "clarification_required";
      options: readonly ClarificationOption[];
    }>
  | Readonly<{ kind: "no_results" }>
  | Readonly<{ kind: "result_set_too_large" }>;

const occurrenceByReport = (
  occurrences: readonly ReportOccurrence[],
): ReadonlyMap<string, ReportOccurrence> =>
  new Map(occurrences.map((occurrence) => [occurrence.reportId, occurrence]));

const projectCandidates = (
  occurrences: readonly ReportOccurrence[],
  sectionScopes: ResolveSearchPlanInput["sectionScopes"],
): readonly SearchCandidate[] => {
  const byReport = occurrenceByReport(occurrences);
  return sectionScopes.flatMap((scope) => {
    const occurrence = byReport.get(scope.reportId);
    return occurrence ? projectSectionCandidates(occurrence, scope) : [];
  });
};

const resolutionInput = (
  plan: SearchPlan,
  retrieval: Awaited<ReturnType<typeof authorizeReportOccurrences>>,
  { actorId, resolutionTokens, tokenCodec }: CandidateResolutionContext,
): ResolveSearchPlanInput => ({
  plan,
  actorId,
  occurrences: retrieval.occurrences,
  sectionScopes: retrieval.sectionScopes,
  catalog: buildReportAssistantEntityCatalog(retrieval),
  resolutionTokens,
  tokenCodec,
});

export const resolveReportAssistantCandidates = async (
  repository: ReportSearchRepository,
  plan: SearchPlan,
  context: CandidateResolutionContext,
): Promise<CandidateResolution> => {
  const { actorId, clock, timeZone } = context;
  const publishedOptions = {
    publishedMode: plan.periods.published.mode,
    ...(plan.periods.published.count !== null
      ? { publishedCount: plan.periods.published.count }
      : {}),
    ...(plan.periods.published.mode === "named"
      ? { publishedLabels: plan.periods.published.references }
      : {}),
  };
  // eslint-disable-next-line no-restricted-syntax -- selection result is assigned inside the guarded operation
  let sources: readonly SelectableReportSource[];
  try {
    sources = selectPeriodSources(
      await repository.listSources(publishedOptions),
      plan,
      clock.now,
    );
  } catch (error) {
    if (error instanceof ReportSearchResultSetTooLargeError) {
      return { kind: "result_set_too_large" };
    }
    throw error;
  }
  const occurrences = await repository.loadOccurrences(sources);
  const authorized = await authorizeReportOccurrences(
    repository,
    actorId,
    occurrences,
  );
  if (authorized.occurrences.length === 0) return { kind: "no_results" };

  const resolved = resolveSearchPlanEntities(
    resolutionInput(plan, authorized, context),
  );
  if (resolved.kind !== "resolved") return resolved;

  const candidates = filterCandidates(
    projectCandidates(resolved.plan.occurrences, resolved.plan.sectionScopes),
    resolved.plan,
    { now: clock.now, timeZone },
  );
  return candidates.length === 0
    ? { kind: "no_results" }
    : { kind: "resolved", plan: resolved.plan, candidates };
};
