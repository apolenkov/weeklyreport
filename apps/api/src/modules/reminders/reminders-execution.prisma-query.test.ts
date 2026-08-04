import { describe, expect, it, vi } from "vitest";

import { markStuckSendingSent } from "./reminders-execution.prisma-query.js";

const asNever = (value: unknown): never => value as never;

// A `sending` row is never reaped by the queued path; the reconciliation CAS
// must target exactly `sending` rows older than the cutoff and resolve them to
// `sent` (presumed delivered) — never re-queue or fail a presumed-sent email.
describe("markStuckSendingSent", () => {
  it("CAS-resolves only sending rows older than the cutoff", async () => {
    const prisma = {
      reminderExecution: {
        updateMany: vi.fn().mockResolvedValue({ count: 3 }),
      },
    };
    const cutoff = new Date("2026-04-11T11:30:00.000Z");

    const count = await markStuckSendingSent(asNever(prisma), cutoff);

    expect(count).toBe(3);
    expect(prisma.reminderExecution.updateMany.mock.calls).toMatchObject([
      [
        {
          where: { status: "sending", updatedAt: { lt: cutoff } },
          data: { status: "sent" },
        },
      ],
    ]);
  });

  it("reports zero when no row is past the cutoff", async () => {
    const prisma = {
      reminderExecution: {
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
    };

    const count = await markStuckSendingSent(
      asNever(prisma),
      new Date("2026-04-11T11:30:00.000Z"),
    );

    expect(count).toBe(0);
    expect(prisma.reminderExecution.updateMany).toHaveBeenCalledTimes(1);
  });
});
