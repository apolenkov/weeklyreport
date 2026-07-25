import { vi } from "vitest";

import type { AdminRepository } from "./admin-shared.js";

type StubbedMethod =
  | "activateUser"
  | "archivePeriod"
  | "attachProductToGroup"
  | "countActiveTelegramBindings"
  | "countPendingReopenRequests"
  | "createPeriodManual"
  | "deactivateUser"
  | "decideReopenRequest"
  | "deleteReminderPolicy"
  | "deleteReport"
  | "detachProductFromGroup"
  | "findOverlappingPeriod"
  | "listGroupProducts"
  | "listPeriodsByState"
  | "listProductGroupOwnership"
  | "listProductGroups"
  | "listReminderPolicies"
  | "listReopenRequests"
  | "listStageAssignmentCounts"
  | "listStages"
  | "readPeriodById"
  | "readReportForDelete"
  | "saveReminderPolicy"
  | "unarchivePeriod"
  | "updatePeriodManual";

export type AdminRepositoryUnusedStubs = Pick<AdminRepository, StubbedMethod>;

const STUB_ID = "00000000-0000-4000-8000-000000000000";
const STUB_DATE = new Date(0);

// Neutral stubs for methods a test does not exercise; doubles override owned behavior.
/**
 * Unused Admin Repository Stubs.
 */
export function unusedAdminRepositoryStubs(): AdminRepositoryUnusedStubs {
  return {
    activateUser: vi.fn().mockResolvedValue(undefined),
    archivePeriod: vi.fn().mockResolvedValue(undefined),
    attachProductToGroup: vi.fn((input) =>
      Promise.resolve({ id: STUB_ID, ...input, createdAt: STUB_DATE }),
    ),
    countActiveTelegramBindings: vi.fn().mockResolvedValue(0),
    countPendingReopenRequests: vi.fn().mockResolvedValue(0),
    createPeriodManual: vi.fn((input) =>
      Promise.resolve({ id: STUB_ID, ...input }),
    ),
    deactivateUser: vi.fn().mockResolvedValue(undefined),
    decideReopenRequest: vi
      .fn()
      .mockResolvedValue({ kind: "already-processed" }),
    deleteReminderPolicy: vi.fn().mockResolvedValue(undefined),
    deleteReport: vi.fn().mockResolvedValue(undefined),
    detachProductFromGroup: vi.fn().mockResolvedValue(undefined),
    findOverlappingPeriod: vi.fn().mockResolvedValue(null),
    listGroupProducts: vi.fn().mockResolvedValue([]),
    listPeriodsByState: vi.fn().mockResolvedValue([]),
    listProductGroupOwnership: vi.fn((productIds: readonly string[]) =>
      Promise.resolve(
        productIds.map((productId) => ({ productId, group: null })),
      ),
    ),
    listProductGroups: vi.fn().mockResolvedValue([]),
    listReminderPolicies: vi.fn().mockResolvedValue([]),
    listReopenRequests: vi.fn().mockResolvedValue([]),
    listStageAssignmentCounts: vi.fn().mockResolvedValue([]),
    listStages: vi.fn().mockResolvedValue([]),
    readPeriodById: vi.fn().mockResolvedValue(null),
    readReportForDelete: vi.fn().mockResolvedValue(null),
    saveReminderPolicy: vi.fn((policy) => Promise.resolve(policy)),
    unarchivePeriod: vi
      .fn()
      .mockResolvedValue({ nextPeriodState: "open", nextPeriodStatus: "open" }),
    updatePeriodManual: vi.fn().mockResolvedValue({
      id: STUB_ID,
      periodStart: STUB_DATE,
      periodEnd: STUB_DATE,
      deadline: STUB_DATE,
      weekLabel: null,
      periodState: "open",
    }),
  };
}
