import {
  type RecordOmissionSummary,
  summarizeRecordOmissions,
  summarizeRecordOmissionsForScopes,
} from "@weeklyreport/shared";

import { filterSectionToSharedProducts } from "../../report-sections/index.js";
import { uniqueStrings } from "../domain/entity-resolver.catalog.js";
import type {
  ReportOccurrence,
  SectionScope,
} from "../domain/report-retrieval.types.js";
import type { ReportSearchAccessRepository } from "./report-search.repository.js";

export type AuthorizedReportRetrieval = Readonly<{
  occurrences: readonly ReportOccurrence[];
  sectionScopes: readonly SectionScope[];
  // What the authorized corpus leaves out, counted under the same lens as its
  // content: the whole own section, only the shared Products of a foreign one.
  coverage: RecordOmissionSummary;
}>;

const scopeCoverage = (
  occurrence: ReportOccurrence,
  scope: SectionScope,
  sharedProducts: ReadonlyMap<string, ReadonlySet<string>>,
): RecordOmissionSummary => {
  const omission = occurrence.recordOmissions?.get(scope.sectionId);
  return scope.visibility === "own"
    ? summarizeRecordOmissions([omission])
    : summarizeRecordOmissionsForScopes(
        [omission],
        [...(sharedProducts.get(scope.authorId) ?? [])].map((parentId) => ({
          parentKind: "product" as const,
          parentId,
        })),
      );
};

const addCoverage = (
  left: RecordOmissionSummary,
  right: RecordOmissionSummary,
): RecordOmissionSummary => ({
  risks: left.risks + right.risks,
  decisions: left.decisions + right.decisions,
  unknown: left.unknown || right.unknown,
});

const sharedProductsByAuthor = (
  entries: readonly (readonly [string, readonly string[]])[],
): ReadonlyMap<string, ReadonlySet<string>> =>
  new Map(
    entries.map(([authorId, productIds]) => [authorId, new Set(productIds)]),
  );

const authorizedSection = (
  actorId: string,
  occurrence: ReportOccurrence,
  section: ReportOccurrence["sections"][number],
  sharedProducts: ReadonlyMap<string, ReadonlySet<string>>,
): SectionScope | null => {
  if (section.authorId === actorId) {
    return {
      reportId: occurrence.reportId,
      sectionId: section.reportSectionId,
      authorId: section.authorId,
      visibility: "own",
      section,
    };
  }

  const productIds = sharedProducts.get(section.authorId);
  if (!productIds || productIds.size === 0) return null;

  return {
    reportId: occurrence.reportId,
    sectionId: section.reportSectionId,
    authorId: section.authorId,
    visibility: "shared_products",
    section: filterSectionToSharedProducts(section, productIds),
  };
};

const authorizedOccurrence = (
  actorId: string,
  occurrence: ReportOccurrence,
  reportAccess: ReadonlySet<string>,
  sharedProducts: ReadonlyMap<string, ReadonlySet<string>>,
): Readonly<{
  occurrence: ReportOccurrence;
  scopes: readonly SectionScope[];
}> | null => {
  if (!reportAccess.has(occurrence.reportId)) return null;

  const scopes = occurrence.sections.flatMap((section) => {
    const scope = authorizedSection(
      actorId,
      occurrence,
      section,
      sharedProducts,
    );
    return scope ? [scope] : [];
  });
  return scopes.length > 0
    ? {
        occurrence: {
          ...occurrence,
          sections: scopes.map(({ section }) => section),
        },
        scopes,
      }
    : null;
};

/**
 * Prove Lead report access before constructing any foreign section scope.
 * Foreign sections receive the existing shared-product lens in this function,
 * so CandidateProjector never sees an unfiltered foreign read model.
 */
export async function authorizeReportOccurrences(
  repository: ReportSearchAccessRepository,
  actorId: string,
  occurrences: readonly ReportOccurrence[],
): Promise<AuthorizedReportRetrieval> {
  const reportIds = uniqueStrings(
    occurrences.map((occurrence) => occurrence.reportId),
  );
  const candidateForeignAuthorIds = uniqueStrings(
    occurrences.flatMap((occurrence) =>
      occurrence.sections
        .filter((section) => section.authorId !== actorId)
        .map((section) => section.authorId),
    ),
  );
  const atomicSnapshot = await repository.getAuthorizationSnapshot(
    actorId,
    reportIds,
    candidateForeignAuthorIds,
  );
  const reportAccess = new Set(atomicSnapshot.ownSectionReportIds);
  const foreignAuthorIds = uniqueStrings(
    occurrences
      .filter((occurrence) => reportAccess.has(occurrence.reportId))
      .flatMap((occurrence) =>
        occurrence.sections
          .filter((section) => section.authorId !== actorId)
          .map((section) => section.authorId),
      ),
  );
  const sharedProducts = foreignAuthorIds.map(
    (authorId) =>
      [
        authorId,
        atomicSnapshot.sharedProductIdsByAuthor.get(authorId) ?? [],
      ] as const,
  );
  const sharedProductsByAuthorIndex = sharedProductsByAuthor(sharedProducts);
  const authorized = occurrences.flatMap((occurrence) => {
    const result = authorizedOccurrence(
      actorId,
      occurrence,
      reportAccess,
      sharedProductsByAuthorIndex,
    );
    return result ? [result] : [];
  });

  return {
    occurrences: authorized.map(({ occurrence }) => occurrence),
    sectionScopes: authorized.flatMap(({ scopes }) => scopes),
    coverage: authorized
      .flatMap(({ occurrence, scopes }) =>
        scopes.map((scope) =>
          scopeCoverage(occurrence, scope, sharedProductsByAuthorIndex),
        ),
      )
      .reduce(addCoverage, summarizeRecordOmissions([])),
  };
}
