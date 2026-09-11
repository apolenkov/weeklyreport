import { describe, expect, it, vi } from "vitest";

import { ReviewAccessError } from "../application/review.service.js";
import {
  assertAcknowledgementAccess,
  assertReviewEntitlement,
  assertReviewEntitlementByUserId,
} from "./review-write-gate.js";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const GROUP_ID = "22222222-2222-4222-8222-222222222222";

function transactionUser(user: {
  readonly isActive: boolean;
  readonly role: string;
  readonly reportingGroupId: string | null;
  readonly viewerGroupAccess: readonly {
    readonly groupId: string;
    readonly canReview: boolean;
  }[];
}) {
  return {
    user: { findUnique: vi.fn().mockResolvedValue(user) },
  } as never;
}

const accessOnlyViewer = {
  isActive: true,
  role: "viewer",
  reportingGroupId: null,
  viewerGroupAccess: [{ groupId: GROUP_ID, canReview: false }],
};

describe("review write gates", () => {
  it("allows acknowledgement for an access-only viewer", async () => {
    await expect(
      assertAcknowledgementAccess(
        transactionUser(accessOnlyViewer),
        { userId: USER_ID, role: "viewer" },
        GROUP_ID,
      ),
    ).resolves.toBeUndefined();
  });

  it.each([
    [
      "comments",
      (tx: never) =>
        assertReviewEntitlement(
          tx,
          { userId: USER_ID, role: "viewer" },
          GROUP_ID,
        ),
    ],
    [
      "verdicts",
      (tx: never) => assertReviewEntitlementByUserId(tx, USER_ID, GROUP_ID),
    ],
  ])("still requires reviewer designation for %s", async (_label, check) => {
    await expect(
      check(transactionUser(accessOnlyViewer)),
    ).rejects.toBeInstanceOf(ReviewAccessError);
  });

  it.each([
    [
      "comments",
      (tx: never) =>
        assertReviewEntitlement(
          tx,
          { userId: USER_ID, role: "viewer" },
          GROUP_ID,
        ),
    ],
    [
      "verdicts",
      (tx: never) => assertReviewEntitlementByUserId(tx, USER_ID, GROUP_ID),
    ],
  ])(
    "rejects an inactive designated reviewer for %s",
    async (_label, check) => {
      await expect(
        check(
          transactionUser({
            isActive: false,
            role: "viewer",
            reportingGroupId: null,
            viewerGroupAccess: [{ groupId: GROUP_ID, canReview: true }],
          }),
        ),
      ).rejects.toBeInstanceOf(ReviewAccessError);
    },
  );

  it("does not grant acknowledgement authority to a lead", async () => {
    await expect(
      assertAcknowledgementAccess(
        transactionUser({
          isActive: true,
          role: "lead",
          reportingGroupId: GROUP_ID,
          viewerGroupAccess: [{ groupId: GROUP_ID, canReview: true }],
        }),
        { userId: USER_ID, role: "lead", reportingGroupId: GROUP_ID },
        GROUP_ID,
      ),
    ).rejects.toBeInstanceOf(ReviewAccessError);
  });
});
