import type { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import { buildTransition } from "../domain/period-transition.js";
import { applyTransition, runTransition } from "./period-transition.apply.js";

// applyTransition is a one-liner over tx.report.update; the unit test pins the
// delegation contract (right id, data sourced from buildTransition) without a
// database. The real atomicity is covered by the integration test.

describe("applyTransition", () => {
  it("updates the report by id with the builder's field set", async () => {
    const updated = { id: "report-1" };
    const update = vi.fn().mockResolvedValue(updated);
    const tx = { report: { update } } as unknown as Prisma.TransactionClient;

    const now = new Date("2026-05-29T12:00:00.000Z");
    const result = await applyTransition(tx, "report-1", "publish", {
      now,
      userId: "user-1",
    });

    expect(update).toHaveBeenCalledWith({
      where: { id: "report-1" },
      data: buildTransition("publish", { now, userId: "user-1" }),
    });
    expect(result).toBe(updated);
  });
});

describe("runTransition", () => {
  it("wraps applyTransition in a single $transaction", async () => {
    const updated = { id: "report-2" };
    const update = vi.fn().mockResolvedValue(updated);
    const tx = { report: { update } };
    const prisma = {
      $transaction: vi.fn((cb: (client: typeof tx) => Promise<unknown>) =>
        cb(tx),
      ),
    } as unknown as Parameters<typeof runTransition>[0];

    const result = await runTransition(prisma, "report-2", "archive", {});

    expect(update).toHaveBeenCalledWith({
      where: { id: "report-2" },
      data: buildTransition("archive", {}),
    });
    expect(result).toBe(updated);
  });
});
