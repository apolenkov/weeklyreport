"use client";

import type { QueryClient } from "@tanstack/react-query";

import type { TRPCProxy } from "./trpc";

// Cache-buster helper: fire-and-forget invalidation inside event handlers.
// The promise is intentionally not awaited, but a rejection is still handled
// (logged) so it never surfaces as an unhandled rejection.
function invalidate(qc: QueryClient, filter: unknown): void {
  void qc
    .invalidateQueries(
      filter as Parameters<QueryClient["invalidateQueries"]>[0],
    )
    .catch((error: unknown) => {
      console.error("[cache-keys] invalidateQueries failed", error);
    });
}

export function invalidateDashboard(qc: QueryClient, trpc: TRPCProxy): void {
  invalidate(qc, trpc.review.dashboard.pathFilter());
  invalidate(qc, trpc.archive.list.pathFilter());
  invalidate(qc, trpc.weeklyReport.get.pathFilter());
}

export function invalidateLeadForm(qc: QueryClient, trpc: TRPCProxy): void {
  invalidate(qc, trpc.reports.getActive.pathFilter());
  invalidate(qc, trpc.leadForm.byPeriod.pathFilter());
}

export function invalidateAdmin(qc: QueryClient, trpc: TRPCProxy): void {
  invalidate(qc, trpc.admin.snapshot.pathFilter());
  invalidate(qc, trpc.admin.getSettings.pathFilter());
  // admin.updateOrganization changes the brand strings rendered in the
  // nav-bar (via auth.me) and the landing hero (via org.getPublic) — both
  // caches must drop so the rename is visible immediately after Save.
  invalidate(qc, trpc.admin.getOrganization.pathFilter());
  invalidate(qc, trpc.org.getPublic.pathFilter());
  invalidate(qc, trpc.auth.me.pathFilter());
  invalidate(qc, trpc.weeklyReport.get.pathFilter());
}

export function invalidateLeadHistory(qc: QueryClient, trpc: TRPCProxy): void {
  invalidate(qc, trpc.reports.myHistory.pathFilter());
}

// Publishing and reopening change every report-facing projection, regardless
// of which screen initiated the lifecycle transition.
export function invalidatePeriodLifecycle(
  qc: QueryClient,
  trpc: TRPCProxy,
): void {
  invalidateDashboard(qc, trpc);
  invalidateLeadForm(qc, trpc);
  invalidateLeadHistory(qc, trpc);
}

// Submission revocation changes both report projections and the live activity
// stream shown beside them on the dashboard.
export function invalidateSubmissionDashboard(
  qc: QueryClient,
  trpc: TRPCProxy,
): void {
  invalidateDashboard(qc, trpc);
  invalidate(qc, trpc.activity.live.pathFilter());
}

// review-acknowledgement: a reviewer action (comment, delete, verdict) mutates
// the section read model. A `changes_requested` verdict auto-un-submits, so the
// head report AND the lead's own form must both refetch to reflect the return.
export function invalidateReview(qc: QueryClient, trpc: TRPCProxy): void {
  invalidate(qc, trpc.weeklyReport.get.pathFilter());
  invalidate(qc, trpc.leadForm.byPeriod.pathFilter());
  invalidate(qc, trpc.reports.getActive.pathFilter());
}
