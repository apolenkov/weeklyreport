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
}

export function invalidateLeadHistory(qc: QueryClient, trpc: TRPCProxy): void {
  void qc.invalidateQueries(trpc.reports.myHistory.pathFilter());
}
