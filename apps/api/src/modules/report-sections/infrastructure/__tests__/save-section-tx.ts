// Transaction double for the save-section suites: every statement the save
// transaction issues, observable and overridable per test.
import { vi } from "vitest";

import type { FabricatedRow } from "./report-sections-prisma-harness";

export interface LifecycleGateRow {
  status: string;
  periodState: string;
  periodStatus: string;
  archived: boolean;
  autoPublished: boolean;
  autoArchived: boolean;
  publishedAt: Date | null;
  publishedById: string | null;
  reopenedAt: Date | null;
}

interface PublishedLineageDocumentRow {
  recordType: "item" | "decision";
  stableId: string;
}

export const OPEN_LIFECYCLE_ROW: LifecycleGateRow = {
  status: "draft",
  periodState: "open",
  periodStatus: "open",
  archived: false,
  autoPublished: false,
  autoArchived: false,
  publishedAt: null,
  publishedById: null,
  reopenedAt: null,
};

// The stored identity and details the incomplete-record guard reads back.
export interface StoredDetailRow {
  stableId: string;
  impact?: string | null;
  mitigation?: string | null;
}

export function makeSaveTx(
  updateCount: number,
  reReadResult: FabricatedRow | null,
  lifecycleRows: LifecycleGateRow[] = [OPEN_LIFECYCLE_ROW],
) {
  const noop = vi.fn(() => Promise.resolve({ count: 0 }));
  return {
    // The publish/save row lock (SELECT ... FOR UPDATE on the parent
    // report) runs before the version compare-and-set; an open period lets
    // these characterizations exercise the version lock itself.
    // The canonical status-graph advisory lock is part of every save
    // transaction and must remain observable in this harness.
    $executeRaw: vi.fn(() => Promise.resolve(0)),
    $queryRaw: vi.fn<() => Promise<LifecycleGateRow[]>>(() =>
      Promise.resolve(lifecycleRows),
    ),
    reportSection: {
      updateMany: vi.fn(() => Promise.resolve({ count: updateCount })),
      // The re-read happens INSIDE the transaction (on `tx`, not the outer
      // `prisma` client) — it carries the row's NEW version, so the returned
      // model reflects this fresh fetch rather than the stale input.
      findUnique: vi.fn(() => Promise.resolve(reReadResult)),
    },
    projectStatus: { deleteMany: noop, createMany: noop },
    stageStatus: { deleteMany: noop, createMany: noop },
    activityStatus: {
      deleteMany: vi.fn(() => Promise.resolve({ count: 0 })),
      createMany: vi.fn(() => Promise.resolve({ count: 0 })),
    },
    item: {
      findMany: vi.fn(() => Promise.resolve([])),
      deleteMany: vi.fn(() => Promise.resolve({ count: 0 })),
      createMany: noop,
    },
    risk: {
      findMany: vi.fn((): Promise<StoredDetailRow[]> => Promise.resolve([])),
      deleteMany: noop,
      createMany: noop,
    },
    decision: {
      findMany: vi.fn((): Promise<StoredDetailRow[]> => Promise.resolve([])),
      deleteMany: noop,
      createMany: noop,
    },
    report: {
      findMany: vi.fn(() => Promise.resolve([])),
      findUnique: vi.fn(() => Promise.resolve({ deadline: null })),
    },
    publishedSearchDocument: {
      findMany: vi.fn((): Promise<PublishedLineageDocumentRow[]> =>
        Promise.resolve([]),
      ),
    },
    // No comments → re-insert skipped (no findMany stubs needed).
    recordComment: {
      findMany: vi.fn(() => Promise.resolve([])),
      createMany: noop,
    },
  };
}
