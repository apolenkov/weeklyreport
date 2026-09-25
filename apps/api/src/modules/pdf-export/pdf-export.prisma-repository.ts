import {
  type AssembledReport,
  type PdfExportJob,
  type PublishedReportSnapshot,
  publishedReportSnapshotSchema,
  type UserSession,
} from "@customreport/shared";
import { Inject, Injectable } from "@nestjs/common";

import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import {
  publishedReportScopeWhere,
  requirePublishedSnapshot,
  requireScopedPublishedSnapshot,
} from "../report-sections/index.js";
import {
  assertCanonicalArtifact,
  assertValidCompletionJob,
  isIdenticalCompletedArtifact,
  type LockedPdfExportJobRow,
  type PdfExportDb,
  type PdfExportJobRow,
  PdfExportStateConflictError,
  pdfStatusToDb,
  toExportJob,
} from "./pdf-export.job-state.js";
import type {
  PdfExportJobRecord,
  PdfExportLockedJobWrites,
  PdfExportRepository,
} from "./pdf-export.ports.js";
import { PdfExportDomainError } from "./pdf-export.service.js";

@Injectable()
export class PdfExportPrismaRepository implements PdfExportRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async getPublishedReportForExport(
    reportId: string,
    session: UserSession,
  ): Promise<AssembledReport | null> {
    return this.prisma.$transaction(async (tx) => {
      const report = await tx.report.findFirst({
        where: {
          id: reportId,
          status: "published",
          periodStatus: "published",
          ...(session.role === "admin"
            ? {}
            : publishedReportScopeWhere(session)),
        },
        select: { id: true, publishedSnapshot: true },
      });
      if (!report) return null;
      const snapshot = requirePublishedSnapshot(
        report.publishedSnapshot,
        report.id,
      );
      return requireScopedPublishedSnapshot(snapshot, session);
    });
  }

  async createExportJob(
    job: PdfExportJob,
    requestedBy: string,
    publicationSnapshot: AssembledReport,
  ): Promise<PdfExportJob> {
    if (requestedBy === "") {
      throw new PdfExportDomainError(
        "PDF export job creation requires a requester.",
      );
    }
    const snapshot = publicationSnapshot;
    if (!snapshot.publishedAt) {
      throw new PdfExportDomainError(
        `PDF export requires a publication timestamp for report ${job.reportId}.`,
      );
    }
    const created = await this.prisma.pdfExportJob.create({
      data: {
        id: job.jobId,
        reportId: job.reportId,
        publicationAt: snapshot.publishedAt,
        publicationSnapshot: snapshot,
        publicationGroupIds: [
          ...new Set(
            snapshot.sections.flatMap((section) =>
              section.groupId ? [section.groupId] : [],
            ),
          ),
        ],
        status: pdfStatusToDb[job.status],
        requestedBy,
        templateVersion: job.templateVersion,
        filePath: job.artifactUrl,
        checksum: job.checksum,
        error: null,
      },
    });

    return toExportJob(created);
  }

  async getPublishedReportForJob(
    jobId: string,
  ): Promise<PublishedReportSnapshot | null> {
    const row = await this.prisma.pdfExportJob.findUnique({
      where: { id: jobId },
      select: {
        reportId: true,
        publicationAt: true,
        publicationSnapshot: true,
      },
    });
    if (!row) return null;
    const snapshot = publishedReportSnapshotSchema.parse(
      row.publicationSnapshot,
    );
    if (
      snapshot.reportId !== row.reportId ||
      snapshot.publishedAt.getTime() !== row.publicationAt.getTime()
    ) {
      throw new PdfExportDomainError(
        `PDF export job ${jobId} has an invalid publication snapshot.`,
      );
    }
    return snapshot;
  }

  async getExportJob(jobId: string): Promise<PdfExportJobRecord | null> {
    const job = await this.prisma.pdfExportJob.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      return null;
    }

    return toExportJob(job);
  }

  async saveExportJob(job: PdfExportJob): Promise<PdfExportJob> {
    assertValidCompletionJob(job);
    return this.completeExportJob(
      this.prisma,
      job.jobId,
      job.artifactUrl,
      job.checksum,
    );
  }

  async markExportFailed(jobId: string, error: string): Promise<void> {
    await this.failExportJob(this.prisma, jobId, error);
  }

  // One per-export serialization lane: a manual retry and the terminal
  // reconciliation/failure callbacks all run their read-decide-write sequence
  // while holding the row's FOR UPDATE lock, so a stale captured state can
  // never overwrite a revive that committed first (or vice versa).
  async runLockedExportJob<T>(
    jobId: string,
    run: (
      job: PdfExportJobRecord | null,
      writes: PdfExportLockedJobWrites,
    ) => Promise<T>,
  ): Promise<T> {
    return this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<LockedPdfExportJobRow[]>`
        SELECT "id", "reportId", "status", "templateVersion", "filePath",
          "checksum", "error", "requestedBy", "createdAt", "updatedAt"
        FROM "PdfExportJob"
        WHERE "id" = ${jobId}
        FOR UPDATE`;
      const row = rows[0];
      const writes: PdfExportLockedJobWrites = {
        markFailed: (error) => this.failExportJob(tx, jobId, error),
        markCompleted: (artifactUrl, checksum) =>
          this.completeExportJob(tx, jobId, artifactUrl, checksum),
        reviveFailed: () => this.reviveFailedExport(tx, jobId),
      };
      return run(row === undefined ? null : toExportJob(row), writes);
    });
  }

  // Pending-only CAS is preserved inside the lock: a completion that lost the
  // race still fails closed, and an identical completed artifact still reads
  // back as an idempotent success.
  private async completeExportJob(
    db: PdfExportDb,
    jobId: string,
    artifactUrl: string,
    checksum: string,
  ): Promise<PdfExportJob> {
    assertCanonicalArtifact(jobId, artifactUrl, checksum);

    const { count } = await db.pdfExportJob.updateMany({
      where: { id: jobId, status: "pending" },
      data: {
        status: "completed",
        filePath: artifactUrl,
        checksum,
        error: null,
      },
    });

    const current = await this.readExportJobRow(db, jobId);
    if (count === 0) {
      if (isIdenticalCompletedArtifact(current, artifactUrl, checksum)) {
        return toExportJob(current);
      }
      throw new PdfExportStateConflictError(jobId, current.status);
    }

    return toExportJob(current);
  }

  private async failExportJob(
    db: PdfExportDb,
    jobId: string,
    error: string,
  ): Promise<void> {
    const { count } = await db.pdfExportJob.updateMany({
      where: { id: jobId, status: "pending" },
      data: {
        status: "failed",
        filePath: null,
        checksum: null,
        error,
      },
    });

    if (count !== 0) {
      return;
    }

    const current = await this.readExportJobRow(db, jobId);
    if (current.status === "completed" || current.status === "failed") {
      return;
    }

    throw new PdfExportStateConflictError(jobId, current.status);
  }

  // A manual retry revives only the lifecycle fields; the immutable
  // publication identity, requester, and template provenance are untouched.
  private async reviveFailedExport(
    db: PdfExportDb,
    jobId: string,
  ): Promise<void> {
    const { count } = await db.pdfExportJob.updateMany({
      where: { id: jobId, status: "failed" },
      data: {
        status: "pending",
        filePath: null,
        checksum: null,
        error: null,
      },
    });

    if (count === 0) {
      // Unreachable under the row lock after a failed-status check; failing
      // loud rolls the transaction back instead of stranding a pending row.
      const current = await this.readExportJobRow(db, jobId);
      throw new PdfExportDomainError(
        `PDF export job ${jobId} is ${current.status}, not failed; the retry revival was not applied.`,
      );
    }
  }

  private async readExportJobRow(
    db: PdfExportDb,
    jobId: string,
  ): Promise<PdfExportJobRow> {
    const row = await db.pdfExportJob.findUnique({
      where: { id: jobId },
    });

    if (!row) {
      throw new PdfExportDomainError(`PDF export job ${jobId} was not found.`);
    }

    return row;
  }
}
