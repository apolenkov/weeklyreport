import { type PdfExportJob, pdfExportJobSchema } from "@customreport/shared";
import type { Prisma } from "@prisma/client";

import type { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import type { PdfExportJobRecord } from "./pdf-export.ports.js";
import { PdfExportDomainError } from "./pdf-export.service.js";

export const pdfStatusToDb: Record<
  PdfExportJob["status"],
  "pending" | "completed" | "failed"
> = {
  queued: "pending",
  completed: "completed",
  failed: "failed",
};

export const dbStatusToDomain: Record<string, PdfExportJob["status"]> = {
  pending: "queued",
  completed: "completed",
  failed: "failed",
};

export class UnsupportedPdfExportStatusError extends Error {
  constructor(status: string) {
    super(`Unsupported PDF export database status: ${status}`);
    this.name = "UnsupportedPdfExportStatusError";
  }
}

export class PdfExportStateConflictError extends Error {
  constructor(jobId: string, status: string) {
    super(
      `PDF export job ${jobId} is already in terminal state ${status}; completion was not applied.`,
    );
    this.name = "PdfExportStateConflictError";
  }
}

export interface PdfExportJobRow {
  id: string;
  reportId: string;
  status: string;
  templateVersion: string;
  filePath: string | null;
  checksum: string | null;
  error: string | null;
  requestedBy: string;
  publicationAt: Date;
  publicationSnapshot: unknown;
  createdAt: Date;
  updatedAt: Date;
}

// Columns a row-locked mutation needs: the durable identity, the lifecycle
// fields the writes may touch, and the read model's round-tripped metadata.
// The heavy publicationSnapshot/publicationAt payload is never selected here.
export interface LockedPdfExportJobRow {
  id: string;
  reportId: string;
  status: string;
  templateVersion: string;
  filePath: string | null;
  checksum: string | null;
  error: string | null;
  requestedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export type PdfExportDb = PrismaService | Prisma.TransactionClient;

export type CompletedPdfExportJob = PdfExportJob & {
  status: "completed";
  artifactUrl: string;
  checksum: string;
};

export function toDomainStatus(status: string): PdfExportJob["status"] {
  const domainStatus = dbStatusToDomain[status];
  if (domainStatus === undefined) {
    throw new UnsupportedPdfExportStatusError(status);
  }
  return domainStatus;
}

export function toExportJob(row: LockedPdfExportJobRow): PdfExportJobRecord {
  return {
    ...pdfExportJobSchema.parse({
      jobId: row.id,
      reportId: row.reportId,
      status: toDomainStatus(row.status),
      requestedAt: row.createdAt,
      completedAt: row.status === "completed" ? row.updatedAt : null,
      checksum: row.checksum,
      // The template stamped at creation round-trips; a later code release
      // must never relabel a persisted export with its own running version.
      templateVersion: row.templateVersion,
      artifactUrl: row.filePath,
    }),
    requestedBy: row.requestedBy,
  };
}

export function assertValidCompletionJob(
  job: PdfExportJob,
): asserts job is CompletedPdfExportJob {
  if (job.status !== "completed" || job.artifactUrl === null) {
    throw new PdfExportDomainError(
      `PDF export completion requires completed status, artifact URL /pdfs/${job.jobId}.pdf, and a checksum.`,
    );
  }
  assertCanonicalArtifact(job.jobId, job.artifactUrl, job.checksum);
}

export function assertCanonicalArtifact(
  jobId: string,
  artifactUrl: string,
  checksum: string | null,
): asserts checksum is string {
  const expectedArtifactUrl = `/pdfs/${jobId}.pdf`;
  if (
    artifactUrl !== expectedArtifactUrl ||
    checksum === null ||
    checksum.trim() === ""
  ) {
    throw new PdfExportDomainError(
      `PDF export completion requires completed status, artifact URL ${expectedArtifactUrl}, and a checksum.`,
    );
  }
}

export function isIdenticalCompletedArtifact(
  row: LockedPdfExportJobRow,
  artifactUrl: string,
  checksum: string,
): boolean {
  return (
    row.status === "completed" &&
    row.error === null &&
    row.filePath === artifactUrl &&
    row.checksum === checksum
  );
}
