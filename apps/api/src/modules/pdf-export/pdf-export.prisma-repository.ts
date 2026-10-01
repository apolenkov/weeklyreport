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
} from "../report-sections/index.js";
import { scopeSnapshotWithOrgProgress } from "../weekly-report/index.js";
import {
  assertCanonicalArtifact,
  assertValidCompletionJob,
  type CompletedPdfExportJob,
  isIdenticalCompletedArtifact,
  type LockedPdfExportJobRow,
  type PdfExportDb,
  PdfExportDomainError,
  type PdfExportJobRow,
  PdfExportStateConflictError,
  pdfStatusToDb,
  toExportJob,
} from "./pdf-export.job-state.js";
import type {
  PdfExportJobRecord,
  PdfExportLockedJobWrites,
  PdfExportPendingCandidate,
  PdfExportPendingCursor,
  PdfExportRepository,
} from "./pdf-export.ports.js";

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
      return scopeSnapshotWithOrgProgress(snapshot, session);
    });
  }

  async createExportJob(
    job: PdfExportJob,
    requestedBy: string,
    snapshot: AssembledReport,
  ): Promise<PdfExportJob> {
    if (requestedBy === "") {
      throw new PdfExportDomainError(
        "PDF export job creation requires a requester.",
      );
    }
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
        generation: job.generation,
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

    if (!job) return null;

    return toExportJob(job);
  }

  async saveExportJob(job: PdfExportJob): Promise<PdfExportJob> {
    assertValidCompletionJob(job);
    return this.completeExportJob(this.prisma, job);
  }

  async markExportFailed(
    jobId: string,
    generation: number,
    error: string,
  ): Promise<void> {
    await this.failExportJob(this.prisma, jobId, generation, error);
  }

  async listPendingExportCandidates(
    bound: Date,
    cursor: PdfExportPendingCursor | null,
    limit: number,
  ): Promise<PdfExportPendingCandidate[]> {
    const rows = await this.prisma.pdfExportJob.findMany({
      where: {
        status: "pending",
        createdAt: { lte: bound },
        // Keyset `(createdAt, id) > cursor` — every inspected row advances the
        // cursor, so live queue jobs can never starve the pass.
        ...(cursor === null
          ? {}
          : {
              OR: [
                { createdAt: { gt: cursor.createdAt } },
                { createdAt: cursor.createdAt, id: { gt: cursor.jobId } },
              ],
            }),
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take: limit,
      select: { id: true, generation: true, createdAt: true },
    });
    return rows.map((row) => ({
      jobId: row.id,
      generation: row.generation,
      createdAt: row.createdAt,
    }));
  }

  // One per-export serialization lane: a generation advance, a quarantine
  // check, and the terminal reconciliation/failure callbacks all run their
  // read-decide-write sequence while holding the row's FOR UPDATE lock.
  async runLockedExportJob<T>(
    jobId: string,
    run: (
      job: PdfExportJobRecord | null,
      writes: PdfExportLockedJobWrites,
    ) => Promise<T>,
  ): Promise<T> {
    return this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<LockedPdfExportJobRow[]>`
        SELECT "id", "reportId", "status", "generation", "templateVersion",
          "filePath", "checksum", "error", "requestedBy", "createdAt", "updatedAt"
        FROM "PdfExportJob" WHERE "id" = ${jobId} FOR UPDATE`;
      const row = rows[0];
      const writes: PdfExportLockedJobWrites = {
        markFailed: (generation, error) =>
          this.failExportJob(tx, jobId, generation, error),
        markCompleted: (generation, artifactUrl, checksum) =>
          this.completeExportJob(tx, {
            jobId,
            generation,
            artifactUrl,
            checksum,
          }),
        markRecoveryRequired: (generation) =>
          this.markRecoveryRequiredExport(tx, jobId, generation),
        advanceGeneration: (expectedGeneration) =>
          this.advanceExportGeneration(tx, jobId, expectedGeneration),
      };
      return run(row === undefined ? null : toExportJob(row), writes);
    });
  }

  // Pending-only CAS fenced to the claimed generation: a completion that lost
  // the race fails closed; an identical completed artifact reads back as an
  // idempotent success.
  private async completeExportJob(
    db: PdfExportDb,
    completion: Pick<
      CompletedPdfExportJob,
      "jobId" | "generation" | "artifactUrl" | "checksum"
    >,
  ): Promise<PdfExportJob> {
    const { jobId, generation, artifactUrl, checksum } = completion;
    assertCanonicalArtifact(jobId, artifactUrl, checksum);

    const { count } = await db.pdfExportJob.updateMany({
      where: { id: jobId, status: "pending", generation },
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
    generation: number,
    error: string,
  ): Promise<void> {
    const { count } = await db.pdfExportJob.updateMany({
      where: { id: jobId, status: "pending", generation },
      data: { status: "failed", filePath: null, checksum: null, error },
    });

    if (count !== 0) return;

    const current = await this.readExportJobRow(db, jobId);
    if (current.status === "pending" && current.generation === generation) {
      // Unreachable: the CAS just matched this row's state.
      throw new PdfExportStateConflictError(jobId, current.status);
    }
    // A terminal row or a pending row at another generation loses the write
    // race as an idempotent no-op — a stale generation never touches it.
  }

  // Orphan-scan quarantine: pending(g) with a confirmed-absent queue job →
  // recovery_required(g). A miss under the lock is a violated invariant.
  private async markRecoveryRequiredExport(
    db: PdfExportDb,
    jobId: string,
    generation: number,
  ): Promise<void> {
    const { count } = await db.pdfExportJob.updateMany({
      where: { id: jobId, status: "pending", generation },
      data: { status: "recovery_required" },
    });

    if (count === 0) {
      const current = await this.readExportJobRow(db, jobId);
      throw new PdfExportDomainError(
        `PDF export job ${jobId} is ${current.status} at generation ${current.generation}; the recovery quarantine was not applied.`,
      );
    }
  }

  // Head retry transition: failed|recovery_required(g) → pending(g+1). Only
  // the lifecycle fields move; identity and template provenance are untouched.
  private async advanceExportGeneration(
    db: PdfExportDb,
    jobId: string,
    expectedGeneration: number,
  ): Promise<void> {
    const { count } = await db.pdfExportJob.updateMany({
      where: {
        id: jobId,
        status: { in: ["failed", "recovery_required"] },
        generation: expectedGeneration,
      },
      data: {
        status: "pending",
        generation: expectedGeneration + 1,
        filePath: null,
        checksum: null,
        error: null,
      },
    });

    if (count === 0) {
      // Unreachable under the row lock after the caller's eligibility check;
      // failing loud rolls the transaction back instead of stranding the row.
      const current = await this.readExportJobRow(db, jobId);
      throw new PdfExportDomainError(
        `PDF export job ${jobId} is ${current.status} at generation ${current.generation}; the generation advance from ${expectedGeneration} was not applied.`,
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
