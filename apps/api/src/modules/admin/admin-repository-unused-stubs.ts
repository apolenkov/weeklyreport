import { vi } from "vitest";

import type {
  DecideReopenRequestInput,
  ListReopenRequestsInput,
  ReopenDecisionOutcome,
  ReopenRequestRow,
  StageAssignmentCountRow,
  StageRow,
} from "./admin-shared.js";

/**
 * The 8 methods added to `AdminRepository` by drain-admin-router
 * (deactivate/activate user, integrations status, stage catalogue,
 * reopen-request lifecycle), stubbed to a "no data / not exercised" result.
 * None of the pre-existing admin unit-test fakes exercise these paths; spread
 * this into a fake's object literal so it satisfies the (now required)
 * `AdminRepository` port without every call site hand-rolling all 8.
 */
export function unusedAdminRepositoryStubs(): {
  deactivateUser: () => Promise<void>;
  activateUser: () => Promise<void>;
  countActiveTelegramBindings: () => Promise<number>;
  listStages: () => Promise<StageRow[]>;
  listStageAssignmentCounts: () => Promise<StageAssignmentCountRow[]>;
  listReopenRequests: (
    input: ListReopenRequestsInput,
  ) => Promise<ReopenRequestRow[]>;
  countPendingReopenRequests: () => Promise<number>;
  decideReopenRequest: (
    input: DecideReopenRequestInput,
  ) => Promise<ReopenDecisionOutcome>;
} {
  return {
    deactivateUser: vi.fn().mockResolvedValue(undefined),
    activateUser: vi.fn().mockResolvedValue(undefined),
    countActiveTelegramBindings: vi.fn().mockResolvedValue(0),
    listStages: vi.fn().mockResolvedValue([]),
    listStageAssignmentCounts: vi.fn().mockResolvedValue([]),
    listReopenRequests: vi.fn().mockResolvedValue([]),
    countPendingReopenRequests: vi.fn().mockResolvedValue(0),
    decideReopenRequest: vi
      .fn()
      .mockResolvedValue({ kind: "already-processed" }),
  };
}
