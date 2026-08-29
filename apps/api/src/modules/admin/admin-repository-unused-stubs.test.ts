import type { ReminderPolicy } from "@customreport/shared";
import { describe, expect, expectTypeOf, it } from "vitest";

import { unusedAdminRepositoryStubs } from "./admin-repository-unused-stubs.js";
import type { AdminRepository } from "./admin-shared.js";

const ID = "00000000-0000-4000-8000-000000000001";

describe("unusedAdminRepositoryStubs", () => {
  it("returns neutral collection and lookup results", async () => {
    const stubs = unusedAdminRepositoryStubs();

    await expect(stubs.listReminderPolicies()).resolves.toEqual([]);
    await expect(
      stubs.listPeriodsByState({ states: ["open"], limit: 1 }),
    ).resolves.toEqual([]);
    await expect(
      stubs.findOverlappingPeriod({
        periodStart: new Date(0),
        periodEnd: new Date(0),
      }),
    ).resolves.toBeNull();
    await expect(stubs.readPeriodById(ID)).resolves.toBeNull();
    await expect(stubs.listGroupProducts(ID)).resolves.toEqual([]);
    await expect(stubs.listProductGroups(ID)).resolves.toEqual([]);
    await expect(stubs.listProductGroupOwnership([ID])).resolves.toEqual([
      { productId: ID, group: null },
    ]);
  });

  it("returns neutral mutation results", async () => {
    const stubs = unusedAdminRepositoryStubs();
    const policy = { id: ID } as ReminderPolicy;

    await expect(stubs.saveReminderPolicy(policy)).resolves.toBe(policy);
    await expect(stubs.deleteReminderPolicy(ID)).resolves.toBeUndefined();
    await expect(stubs.archivePeriod(ID)).resolves.toBeUndefined();
    await expect(stubs.unarchivePeriod(ID)).resolves.toEqual({
      nextPeriodState: "open",
      nextPeriodStatus: "open",
    });
    await expect(stubs.deleteReport(ID)).resolves.toBeUndefined();
    await expect(
      stubs.detachProductFromGroup({ groupId: ID, productId: ID }),
    ).resolves.toBeUndefined();
  });
});

describe("AdminRepository compile contract", () => {
  it("rejects a production repository with a missing capability", () => {
    const incompleteRepository = {} as Omit<
      AdminRepository,
      "listReminderPolicies"
    >;
    // The test IS the compile step: if AdminRepository ever stops requiring
    // listReminderPolicies, the assignment below becomes legal and the
    // now-unfulfilled @ts-expect-error fails the typecheck.
    // @ts-expect-error A production repository without a required method is invalid.
    const completeRepository: AdminRepository = incompleteRepository;
    expectTypeOf(completeRepository).toBeObject();
  });
});
