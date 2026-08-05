import type { ClarificationOption, SearchPlan } from "@customreport/shared";

import { filterCandidates } from "../domain/candidate-filter.js";
import { projectSectionCandidates } from "../domain/candidate-projector.js";
import { resolveSearchPlanEntities } from "../domain/entity-resolver.plan.js";
import type {
  ClarificationTokenCodec,
  ResolveSearchPlanInput,
} from "../domain/entity-resolver.types.js";
import { selectPeriodSources } from "../domain/period-source-selection.js";
import type {
  ReportOccurrence,
  ResolvedSearchPlan,
  SearchCandidate,
} from "../domain/report-retrieval.types.js";
import { authorizeReportOccurrences } from "./authorized-report-retrieval.js";
import { buildReportAssistantEntityCatalog } from "./report-assistant.catalog.js";
import type { ReportSearchRepository } from "./report-search.repository.js";

type RetrievalClock = Readonly<{ now: Date }>;

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
  | Readonly<{ kind: "no_results" }>;

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
  actorId: string,
  retrieval: Awaited<ReturnType<typeof authorizeReportOccurrences>>,
  resolutionTokens: readonly string[],
  tokenCodec: ClarificationTokenCodec,
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
  actorId: string,
  resolutionTokens: readonly string[],
  tokenCodec: ClarificationTokenCodec,
  clock: RetrievalClock,
  timeZone: string,
): Promise<CandidateResolution> => {
  const sources = selectPeriodSources(
    await repository.listSources(),
    plan,
    clock.now,
  );
  const occurrences = await repository.loadOccurrences(sources);
  const authorized = await authorizeReportOccurrences(
    repository,
    actorId,
    occurrences,
  );
  if (authorized.occurrences.length === 0) return { kind: "no_results" };

  const resolved = resolveSearchPlanEntities(
    resolutionInput(plan, actorId, authorized, resolutionTokens, tokenCodec),
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
