import {
  type PublishedReportSnapshot,
  publishedReportSnapshotSchema,
} from "./report.schema.js";

/** Immutable authorization scope row derived from a published report snapshot. */
interface PublishedSectionScopeProjection {
  readonly reportId: string;
  readonly reportSectionId: string;
  readonly authorId: string;
  readonly groupId: string;
}

/** Immutable full-text search row derived from a published report snapshot. */
interface PublishedSearchDocumentProjection {
  readonly reportId: string;
  readonly reportSectionId: string;
  readonly recordType: "item" | "risk" | "decision";
  readonly recordId: string;
  readonly stableId: string;
  readonly groupId: string;
  readonly projectId: string | null;
  readonly title: string;
  readonly searchText: string;
  readonly createdAt: Date;
}

/** The complete immutable projection set persisted for a published report. */
interface PublishedProjections {
  readonly sectionScopes: readonly PublishedSectionScopeProjection[];
  readonly searchDocuments: readonly PublishedSearchDocumentProjection[];
}

function projectionFailure(reportId: string, detail: string): never {
  throw new Error(
    `Published snapshot integrity failure for report ${reportId}: ${detail}`,
  );
}

function documentsForSection(
  snapshot: PublishedReportSnapshot,
  section: PublishedReportSnapshot["sections"][number],
): readonly PublishedSearchDocumentProjection[] {
  const common = {
    reportId: snapshot.reportId,
    reportSectionId: section.reportSectionId,
    groupId: section.groupId,
    createdAt: snapshot.publishedAt,
  };

  return [
    ...section.items.map((item) => ({
      ...common,
      recordType: "item" as const,
      recordId: item.id,
      stableId: item.stableId,
      projectId: item.projectId ?? null,
      title: item.text,
      searchText: item.text,
    })),
    ...section.risks.map((risk) => ({
      ...common,
      recordType: "risk" as const,
      recordId: risk.id,
      stableId: risk.stableId,
      projectId: risk.projectId ?? null,
      title: risk.risk,
      searchText: `${risk.risk} — ${risk.impact} — ${risk.mitigation}`,
    })),
    ...section.decisions.map((decision) => ({
      ...common,
      recordType: "decision" as const,
      recordId: decision.id,
      stableId: decision.stableId,
      projectId: null,
      title: decision.text,
      searchText: decision.text,
    })),
  ];
}

/** Derives immutable authorization and full-text rows from one parsed snapshot. */
export function buildPublishedProjections(
  snapshot: PublishedReportSnapshot,
): PublishedProjections {
  // Re-run the canonical schema here because this function is also a public
  // boundary for restored JSON and callers may have bypassed its TypeScript
  // type. Identity validation must not drift from snapshot persistence.
  const parsedSnapshot = publishedReportSnapshotSchema.parse(snapshot);
  parsedSnapshot.sections.forEach((section) => {
    if (section.reportId !== parsedSnapshot.reportId) {
      projectionFailure(
        parsedSnapshot.reportId,
        `section ${section.reportSectionId} belongs to report ${section.reportId}.`,
      );
    }
  });
  const searchDocuments = parsedSnapshot.sections.flatMap((section) =>
    documentsForSection(parsedSnapshot, section),
  );

  return {
    sectionScopes: parsedSnapshot.sections.map((section) => ({
      reportId: parsedSnapshot.reportId,
      reportSectionId: section.reportSectionId,
      authorId: section.authorId,
      groupId: section.groupId,
    })),
    searchDocuments,
  };
}
