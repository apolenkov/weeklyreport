import type { PrismaClient } from "@prisma/client";
import { parsePublishedSnapshot } from "@weeklyreport/report-persistence";
import { z } from "zod";

import { projectSectionCandidates } from "../src/modules/search/domain/candidate-projector.js";
import type { SelectableReportSource } from "../src/modules/search/domain/period-source-selection.js";
import type {
  ReportOccurrence,
  SearchCandidate,
  SectionScope,
} from "../src/modules/search/domain/report-retrieval.types.js";

export type AssistantReadinessOptions = Readonly<{
  label: string;
  actorId: string;
  expectedCurrentReportId: string;
  expectedPublishedReportIds: readonly string[];
  now: Date;
}>;

export type AssistantReadinessDigestEntry = Readonly<{
  occurrenceId: string;
  kind: SearchCandidate["kind"];
}>;

type PublishedSnapshot = ReturnType<typeof parsePublishedSnapshot>;
type PublishedSnapshotRow = Readonly<{
  status: string;
  periodStatus: string;
  periodState: string;
  archived: boolean;
  publishedSnapshot: Parameters<typeof parsePublishedSnapshot>[0];
}>;

const uuidSchema = z.uuid();

function fail(
  options: AssistantReadinessOptions,
  stage: string,
  reportId: string,
  detail: string,
): never {
  throw new Error(
    `[${options.label}] assistant readiness ${stage} for report ${reportId}: ${detail}`,
  );
}

function failSnapshot(
  options: AssistantReadinessOptions,
  reportId: string,
  detail: string,
): never {
  return fail(options, "published_snapshot", reportId, detail);
}

function publishedLifecycleIsValid(row: PublishedSnapshotRow): boolean {
  return (
    row.status === "published" &&
    row.periodStatus === "published" &&
    ((row.periodState === "published" && !row.archived) ||
      (row.periodState === "archived" && row.archived))
  );
}

function snapshotIsValid(
  snapshot: PublishedSnapshot,
  reportId: string,
): boolean {
  return (
    snapshot !== null &&
    snapshot.reportId === reportId &&
    snapshot.sections.length > 0 &&
    snapshot.sections.every((section) => section.reportId === reportId)
  );
}

function assertPublishedSnapshotRow(
  options: AssistantReadinessOptions,
  reportId: string,
  row: PublishedSnapshotRow | undefined,
): void {
  if (row === undefined) {
    failSnapshot(options, reportId, "row is missing");
  }
  if (!publishedLifecycleIsValid(row)) {
    failSnapshot(options, reportId, "published lifecycle tuple is invalid");
  }
  let snapshot: PublishedSnapshot | undefined;
  try {
    snapshot = parsePublishedSnapshot(row.publishedSnapshot);
  } catch {
    failSnapshot(
      options,
      reportId,
      "snapshot does not match the published schema",
    );
  }
  if (!snapshotIsValid(snapshot, reportId)) {
    failSnapshot(options, reportId, "snapshot is absent, empty, or mismatched");
  }
}

export async function assertPublishedSnapshots(
  prisma: PrismaClient,
  options: AssistantReadinessOptions,
): Promise<void> {
  const expectedIds = [...new Set(options.expectedPublishedReportIds)];
  const rows = await prisma.report.findMany({
    where: { id: { in: expectedIds } },
    select: {
      id: true,
      status: true,
      periodStatus: true,
      periodState: true,
      archived: true,
      publishedSnapshot: true,
    },
  });
  const byId = new Map(rows.map((row) => [row.id, row]));
  for (const reportId of expectedIds) {
    assertPublishedSnapshotRow(options, reportId, byId.get(reportId));
  }
}

function isValidRecordIdentity(candidate: SearchCandidate): boolean {
  if (candidate.kind === "stage_status") {
    const [projectId, stageId, extra] = candidate.identity.recordId.split(":");
    return (
      extra === undefined &&
      uuidSchema.safeParse(projectId).success &&
      uuidSchema.safeParse(stageId).success
    );
  }
  return uuidSchema.safeParse(candidate.identity.recordId).success;
}

function assertCandidateIdentity(
  options: AssistantReadinessOptions,
  occurrence: ReportOccurrence,
  candidate: SearchCandidate,
  seen: Set<string>,
): AssistantReadinessDigestEntry {
  const { identity } = candidate;
  const prefix = `${occurrence.reportId}:${candidate.context.sectionId}:${candidate.kind}:`;
  if (
    !identity.recordId ||
    identity.occurrenceId !== `${prefix}${identity.recordId}` ||
    !isValidRecordIdentity(candidate)
  ) {
    fail(
      options,
      "identity",
      occurrence.reportId,
      "candidate identity is invalid",
    );
  }
  if (seen.has(identity.occurrenceId)) {
    fail(
      options,
      "identity",
      occurrence.reportId,
      "candidate occurrence is duplicated",
    );
  }
  seen.add(identity.occurrenceId);
  return { occurrenceId: identity.occurrenceId, kind: candidate.kind };
}

const failSource = (
  options: AssistantReadinessOptions,
  source: SelectableReportSource,
  detail: string,
  suffix: string,
): never =>
  fail(
    options,
    `${source.source === "live" ? "current" : "published"}_${suffix}`,
    source.reportId,
    detail,
  );

export function assertSelectedSources(
  selected: readonly SelectableReportSource[],
  options: AssistantReadinessOptions,
): void {
  const current = selected.find((source) => source.source === "live");
  if (current?.reportId !== options.expectedCurrentReportId) {
    fail(
      options,
      "current_source",
      options.expectedCurrentReportId,
      current === undefined
        ? "no eligible current source was selected"
        : `selected current source is ${current.reportId}`,
    );
  }
  for (const reportId of options.expectedPublishedReportIds) {
    const source = selected.find(
      (candidate) => candidate.reportId === reportId,
    );
    if (source?.source !== "snapshot") {
      fail(
        options,
        "published_source",
        reportId,
        "published source was not selected",
      );
    }
  }
}

export function assertPrimarySections(
  selected: readonly SelectableReportSource[],
  occurrences: readonly ReportOccurrence[],
  options: AssistantReadinessOptions,
): ReadonlyMap<string, ReportOccurrence> {
  const occurrenceByReportId = new Map(
    occurrences.map((occurrence) => [occurrence.reportId, occurrence]),
  );
  for (const source of selected) {
    const occurrence = occurrenceByReportId.get(source.reportId);
    if (
      occurrence?.sections.some(
        (section) => section.authorId === options.actorId,
      ) !== true
    ) {
      failSource(
        options,
        source,
        occurrence === undefined
          ? "source has no readable occurrence"
          : "source has no primary lead section",
        "primary",
      );
    }
  }
  return occurrenceByReportId;
}

function authorizedOccurrenceFor(
  source: SelectableReportSource,
  authorizedOccurrences: readonly ReportOccurrence[],
  options: AssistantReadinessOptions,
): ReportOccurrence {
  const authorizedOccurrence = authorizedOccurrences.find(
    (candidate) => candidate.reportId === source.reportId,
  );
  return (
    authorizedOccurrence ??
    fail(
      options,
      "authorization",
      source.reportId,
      "primary lead access was not granted",
    )
  );
}

function ownScopesFor(
  source: SelectableReportSource,
  scopes: readonly SectionScope[],
  options: AssistantReadinessOptions,
): readonly SectionScope[] {
  const ownScopes = scopes.filter(
    (scope) =>
      scope.reportId === source.reportId &&
      scope.authorId === options.actorId &&
      scope.visibility === "own",
  );
  return ownScopes.length > 0
    ? ownScopes
    : failSource(
        options,
        source,
        "primary lead section was not authorized",
        "primary",
      );
}

function projectOwnScopes(
  source: SelectableReportSource,
  occurrence: ReportOccurrence,
  ownScopes: readonly SectionScope[],
  options: AssistantReadinessOptions,
): readonly SearchCandidate[] {
  const candidates = ownScopes.flatMap((scope) =>
    projectSectionCandidates(occurrence, scope),
  );
  return candidates.length > 0
    ? candidates
    : failSource(
        options,
        source,
        "primary lead has no projectable candidates",
        "candidates",
      );
}

export function digestSource(
  source: SelectableReportSource,
  occurrence: ReportOccurrence,
  context: {
    readonly authorizedOccurrences: readonly ReportOccurrence[];
    readonly scopes: readonly SectionScope[];
    readonly options: AssistantReadinessOptions;
    readonly seen: Set<string>;
  },
): readonly AssistantReadinessDigestEntry[] {
  const { authorizedOccurrences, scopes, options, seen } = context;
  const authorizedOccurrence = authorizedOccurrenceFor(
    source,
    authorizedOccurrences,
    options,
  );
  const ownScopes = ownScopesFor(source, scopes, options);
  return projectOwnScopes(source, authorizedOccurrence, ownScopes, options).map(
    (candidate) =>
      assertCandidateIdentity(options, occurrence, candidate, seen),
  );
}
