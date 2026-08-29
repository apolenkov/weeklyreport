import { describe, expect, it, vi } from "vitest";

import { applyRevokeTransition } from "./revoke-transition.js";

describe("applyRevokeTransition", () => {
  it("atomically restricts the transition to editable report periods", async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 0 });

    await expect(
      applyRevokeTransition(
        { reportSection: { updateMany } } as never,
        "44444444-4444-4444-8444-444444444444",
        "55555555-5555-4555-8555-555555555555",
        3,
      ),
    ).resolves.toBe(0);
    expect(updateMany).toHaveBeenCalledWith({
      where: {
        id: "44444444-4444-4444-8444-444444444444",
        status: "submitted",
        report: {
          archived: false,
          periodStatus: { in: ["open", "reopened"] },
        },
        version: 3,
      },
      data: {
        status: "draft",
        revokedAt: expect.any(Date) as unknown,
        revokedBy: "55555555-5555-4555-8555-555555555555",
        submittedAt: null,
      },
    });
  });
});
