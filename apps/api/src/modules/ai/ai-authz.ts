// Phase 32-A3 (M-02) — resource-level authorization for AI procedures.
//
// The tRPC procedures use protectedProcedure (any authenticated user). The
// AiFacade Prisma reads (getReportForSummary, getRiskForSentiment,
// getCellForOnTrack) do NOT scope by visibility — a viewer who knows a
// risk UUID could trigger Anthropic billing on a draft Risk row they
// shouldn't see.
//
// This helper executes a session-aware visibility check before the AI
// service call. Mirrors the archive surface's PUBLISHED_FLOOR pattern:
// viewer sees only published reports; head/admin see all; lead sees all
// reports they author a section in OR any published report.
//
// Throws TRPCError({code: 'FORBIDDEN'}) when the caller cannot read the
// requested resource. Returns void on success.

import type { UserSession } from "@customreport/shared";
import type { PrismaClient } from "@prisma/client";
import { TRPCError } from "@trpc/server";

/**
 * Build a Prisma `where` clause that returns ≤ 1 Report row only when the
 * given session can read that report. Encodes the visibility rule:
 *   - viewer:           status='published'
 *   - head, admin:      always (no extra filter)
 *   - lead:             status='published' OR section authored by lead
 *
 * Used as `prisma.report.findFirst({ where: { id, ...visibility } })`.
 */
export function reportVisibilityWhere(
  session: UserSession,
): Record<string, unknown> {
  if (session.role === "head" || session.role === "admin") return {};
  if (session.role === "viewer") return { status: "published" };
  // lead — published reports OR reports where they authored a section.
  return {
    OR: [
      { status: "published" },
      { sections: { some: { authorId: session.userId } } },
    ],
  };
}

export async function assertCanReadReport(
  prisma: PrismaClient,
  session: UserSession,
  reportId: string,
): Promise<void> {
  const visibility = reportVisibilityWhere(session);
  const found = await prisma.report.findFirst({
    where: { id: reportId, ...visibility },
    select: { id: true },
  });
  if (!found) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Cannot read this report",
    });
  }
}

export async function assertCanReadRisk(
  prisma: PrismaClient,
  session: UserSession,
  riskId: string,
): Promise<void> {
  // Resolve the risk's reportId via its section, then defer to report
  // visibility. Single Prisma roundtrip for the join.
  const visibility = reportVisibilityWhere(session);
  const found = await prisma.risk.findFirst({
    where: {
      id: riskId,
      reportSection: { report: { ...visibility } },
    },
    select: { id: true },
  });
  if (!found) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Cannot read this risk",
    });
  }
}

export async function assertCanReadSection(
  prisma: PrismaClient,
  session: UserSession,
  sectionId: string,
): Promise<void> {
  const visibility = reportVisibilityWhere(session);
  const found = await prisma.reportSection.findFirst({
    where: {
      id: sectionId,
      report: { ...visibility },
    },
    select: { id: true },
  });
  if (!found) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Cannot read this section",
    });
  }
}
