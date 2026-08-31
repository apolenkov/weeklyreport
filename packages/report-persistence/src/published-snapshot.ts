import {
  type PublishedReportSnapshot,
  publishedReportSnapshotSchema,
} from "@customreport/shared";
import type { Prisma } from "@prisma/client";

/** Raised when immutable publication content cannot be safely consumed. */
export class PublishedSnapshotIntegrityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PublishedSnapshotIntegrityError";
  }
}

export function publishedSnapshotFailure(
  reportId: string | undefined,
  detail: string,
): PublishedSnapshotIntegrityError {
  const reportSuffix = reportId ? ` for report ${reportId}` : "";
  return new PublishedSnapshotIntegrityError(
    `Published snapshot integrity failure${reportSuffix}: ${detail}`,
  );
}

/** Parses a publication snapshot without accepting live read-model variants. */
export function parsePublishedSnapshot(
  value: Prisma.JsonValue | Prisma.InputJsonValue | null | undefined,
): PublishedReportSnapshot | null {
  if (value == null) return null;
  return publishedReportSnapshotSchema.parse(value);
}

function validateSnapshotSections(
  snapshot: PublishedReportSnapshot,
  reportId: string | undefined,
): void {
  const sectionIds = new Set<string>();
  for (const section of snapshot.sections) {
    if (section.reportId !== snapshot.reportId) {
      throw publishedSnapshotFailure(
        reportId,
        `section ${section.reportSectionId} belongs to report ${section.reportId}.`,
      );
    }
    if (sectionIds.has(section.reportSectionId)) {
      throw publishedSnapshotFailure(
        reportId,
        `section ${section.reportSectionId} is duplicated.`,
      );
    }
    sectionIds.add(section.reportSectionId);
  }
}

/**
 * Reads immutable publication content and rejects absent, malformed, or
 * mismatched values before any consumer or projection uses them.
 */
export function requirePublishedSnapshot(
  value: Prisma.JsonValue | Prisma.InputJsonValue | null | undefined,
  reportId?: string,
): PublishedReportSnapshot {
  try {
    const snapshot = parsePublishedSnapshot(value);
    if (!snapshot) {
      throw publishedSnapshotFailure(reportId, "snapshot is absent.");
    }
    if (reportId && snapshot.reportId !== reportId) {
      throw publishedSnapshotFailure(
        reportId,
        `snapshot identifies report ${snapshot.reportId}.`,
      );
    }
    validateSnapshotSections(snapshot, reportId);
    return snapshot;
  } catch (error) {
    if (error instanceof PublishedSnapshotIntegrityError) {
      throw error;
    }
    const suffix = reportId ? ` for report ${reportId}` : "";
    const detail = error instanceof Error ? `: ${error.message}` : "";
    throw new PublishedSnapshotIntegrityError(
      `Published snapshot integrity failure${suffix}${detail}`,
    );
  }
}
