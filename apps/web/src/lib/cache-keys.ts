'use client';

import type { QueryClient } from '@tanstack/react-query';
import type { TRPCProxy } from './trpc';

// invalidateQueries returns a Promise we don't await intentionally — these
// helpers are fire-and-forget cache busters used inside event handlers.

export function invalidateDashboard(qc: QueryClient, trpc: TRPCProxy): void {
  void qc.invalidateQueries(trpc.review.dashboard.pathFilter());
  void qc.invalidateQueries(trpc.archive.list.pathFilter());
  void qc.invalidateQueries(trpc.weeklyReport.get.pathFilter());
}

export function invalidateLeadForm(qc: QueryClient, trpc: TRPCProxy): void {
  void qc.invalidateQueries(trpc.reports.getActive.pathFilter());
  void qc.invalidateQueries(trpc.leadForm.byPeriod.pathFilter());
  void qc.invalidateQueries(trpc.leadForm.versions.pathFilter());
}

export function invalidateAdmin(qc: QueryClient, trpc: TRPCProxy): void {
  void qc.invalidateQueries(trpc.admin.snapshot.pathFilter());
  void qc.invalidateQueries(trpc.admin.getSettings.pathFilter());
  // UFB-047 / Phase 48-A: admin.updateOrganization changes the brand strings
  // rendered in the nav-bar (via auth.me) and the landing hero (via
  // org.getPublic) — both caches must drop so the rename is visible
  // immediately after Save.
  void qc.invalidateQueries(trpc.admin.getOrganization.pathFilter());
  void qc.invalidateQueries(trpc.org.getPublic.pathFilter());
  void qc.invalidateQueries(trpc.auth.me.pathFilter());
  void qc.invalidateQueries(trpc.weeklyReport.get.pathFilter());
}

export function invalidateLeadHistory(qc: QueryClient, trpc: TRPCProxy): void {
  void qc.invalidateQueries(trpc.reports.myHistory.pathFilter());
}
