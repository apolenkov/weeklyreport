import {
  type PeriodStatus,
  type ReportStatus,
  type UserSession,
} from "@customreport/shared";
import { vi } from "vitest";

import {
  type AnalyticsCacheInvalidator,
  type PeriodRepository,
  type ReopenPolicyReader,
} from "../period.service";

export const noopInvalidate: AnalyticsCacheInvalidator = () =>
  Promise.resolve();
export const noGatingReopenPolicy: ReopenPolicyReader = () =>
  Promise.resolve({ allowReopenAfterPublish: true, reopenWindowHours: 0 });

export const reportId = "22222222-2222-4222-8222-222222222222";
export const otherReportId = "33333333-3333-4333-8333-333333333333";

export const headSession: UserSession = {
  userId: "00000000-0000-4000-8000-000000000001",
  email: "head@customreport.local",
  name: "Department Head",
  role: "head",
  activeReportId: reportId,
  activeReportSectionId: null,
};

export const adminSession: UserSession = {
  userId: "00000000-0000-4000-8000-000000000009",
  email: "admin@customreport.local",
  name: "Administrator",
  role: "admin",
  activeReportId: null,
  activeReportSectionId: null,
};

export const archivedReportId = "44444444-4444-4444-8444-444444444444";

export interface SpyReport {
  id: string;
  status: ReportStatus;
  periodStatus: PeriodStatus;
  publishedAt: Date | null;
  // Defaults to false in `getReportById` when a fixture omits it.
  archived?: boolean;
}

export function createSpyRepository(
  reports: Map<string, SpyReport>,
): PeriodRepository & {
  publishPeriod: ReturnType<typeof vi.fn>;
  reopenPeriod: ReturnType<typeof vi.fn>;
} {
  const publishFn = vi.fn((id: string) => {
    const r = reports.get(id);
    // Mirror the guarded compare-and-set: only a not-yet-published, non-archived
    // row transitions. A zero-row match is "raced" (already published — no-op)
    // vs "archived" (archived inside the window — a domain error).
    if (!r || r.periodStatus === "published" || r.archived) {
      const reason: "raced" | "archived" =
        r?.periodStatus === "published" ? "raced" : "archived";
      return Promise.resolve({ transitioned: false as const, reason });
    }
    reports.set(id, {
      ...r,
      periodStatus: "published",
      publishedAt: new Date(),
    });
    return Promise.resolve({ transitioned: true as const });
  });

  const reopenFn = vi.fn((id: string) => {
    const r = reports.get(id);
    if (r) {
      reports.set(id, { ...r, periodStatus: "reopened" });
    }
    return Promise.resolve();
  });

  // Resolve the lifecycle targets from the LIVE map on every call (like the real
  // resolvers) so the publish→reopen→republish cycle stays self-consistent.
  const resolveFirstId = (match: (r: SpyReport) => boolean): string | null =>
    [...reports.values()].find(match)?.id ?? null;

  return {
    getReportById(id: string) {
      const r = reports.get(id);
      return Promise.resolve(
        r ? { ...structuredClone(r), archived: r.archived ?? false } : null,
      );
    },
    getCurrentEditableId: () =>
      Promise.resolve(
        resolveFirstId(
          (r) =>
            (r.periodStatus === "open" || r.periodStatus === "reopened") &&
            !r.archived,
        ),
      ),
    getLatestPublishedNonArchivedId: () =>
      Promise.resolve(
        resolveFirstId((r) => r.periodStatus === "published" && !r.archived),
      ),
    getReopenedNonArchivedId: () =>
      Promise.resolve(
        resolveFirstId((r) => r.periodStatus === "reopened" && !r.archived),
      ),
    publishPeriod: publishFn,
    reopenPeriod: reopenFn,
  };
}

// Mirror of the same helper in publication.service.test.ts — introspects a
// Prometheus Counter without leaking registry internals into assertions.
export async function getCounterValue(
  counter: {
    get(): Promise<{
      values: { value: number; labels: Record<string, unknown> }[];
    }>;
  },
  labels: Record<string, string>,
): Promise<number> {
  const snapshot = await counter.get();
  const match = snapshot.values.find((entry) =>
    Object.entries(labels).every(([k, v]) => String(entry.labels[k]) === v),
  );
  return match?.value ?? 0;
}

export function openReport(id: string, archived = false): SpyReport {
  return {
    id,
    status: "draft",
    periodStatus: "open",
    publishedAt: null,
    archived,
  };
}

export function publishedReport(id: string, archived = false): SpyReport {
  return {
    id,
    status: "published",
    periodStatus: "published",
    publishedAt: new Date(),
    archived,
  };
}

// A reopened period keeps status='published' but flips
// periodStatus to 'reopened' — the marker the single-active-reopen guard reads.
export function reopenedReport(id: string, archived = false): SpyReport {
  return {
    id,
    status: "published",
    periodStatus: "reopened",
    publishedAt: new Date(),
    archived,
  };
}
