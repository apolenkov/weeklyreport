'use client';

import type { QueryClient } from '@tanstack/react-query';
import type { TRPCProxy } from './trpc';

export function invalidateDashboard(qc: QueryClient, trpc: TRPCProxy): void {
  qc.invalidateQueries(trpc.review.dashboard.pathFilter());
  qc.invalidateQueries(trpc.archive.list.pathFilter());
  qc.invalidateQueries(trpc.weeklyReport.get.pathFilter());
}

export function invalidateLeadForm(qc: QueryClient, trpc: TRPCProxy): void {
  qc.invalidateQueries(trpc.reports.getActive.pathFilter());
  qc.invalidateQueries(trpc.leadForm.byPeriod.pathFilter());
  qc.invalidateQueries(trpc.leadForm.versions.pathFilter());
}

export function invalidateAdmin(qc: QueryClient, trpc: TRPCProxy): void {
  qc.invalidateQueries(trpc.admin.snapshot.pathFilter());
  qc.invalidateQueries(trpc.admin.getSettings.pathFilter());
}

export function invalidateLeadHistory(qc: QueryClient, trpc: TRPCProxy): void {
  qc.invalidateQueries(trpc.reports.myHistory.pathFilter());
}
