import type { UserSession } from "@weeklyreport/shared";
import { describe, expect, it, vi } from "vitest";

import type { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import { decideReopenRequest } from "./admin-reopen-request-lifecycle.js";
import {
  AdminAccessError,
  AdminReopenRequestNotFoundError,
} from "./admin-shared.js";

const session: UserSession = {
  userId: "head-1",
  email: "head@test.local",
  name: "Head",
  role: "head",
  reportingGroupId: "group-1",
  viewerGroupAccess: [],
  activeReportId: null,
  activeReportSectionId: null,
};

function setup() {
  const events: string[] = [];
  const actor = { isActive: true, role: "head", reportingGroupId: "group-1" };
  let authorGroup = "group-1";
  const request = {
    id: "req-1",
    reportSectionId: "sec-1",
    reportSection: { authorId: "lead-1" },
  };
  const tx = {
    $queryRaw: vi.fn((strings: TemplateStringsArray, id: string) => {
      const sql = strings.join("?");
      if (sql.includes('FROM "User"')) {
        events.push(`lock-user:${id}`);
        return Promise.resolve([{ id }]);
      }
      events.push("lock-report");
      return Promise.resolve([
        {
          id: "report-1",
          status: "draft",
          periodState: "open",
          periodStatus: "open",
          archived: false,
          autoPublished: false,
          autoArchived: false,
          publishedAt: null,
          publishedById: null,
          reopenedAt: null,
        },
      ]);
    }),
    user: {
      findUnique: vi.fn(() => {
        events.push("read-actor");
        return Promise.resolve(actor);
      }),
    },
    reopenRequest: {
      findFirst: vi.fn(
        (input: {
          where: {
            reportSection: { author?: { reportingGroupId: { in: string[] } } };
          };
        }) => {
          events.push("read-request");
          const groups = input.where.reportSection.author?.reportingGroupId.in;
          return Promise.resolve(
            !groups || groups.includes(authorGroup) ? request : null,
          );
        },
      ),
      updateMany: vi.fn(() => {
        events.push("decide");
        return Promise.resolve({ count: 1 });
      }),
    },
    reportSection: { updateMany: vi.fn(() => Promise.resolve({ count: 1 })) },
  };
  const prisma = {
    $transaction: (callback: (client: typeof tx) => unknown) =>
      Promise.resolve(callback(tx)),
  } as unknown as PrismaService;
  return {
    tx,
    prisma,
    actor,
    events,
    moveAuthor: () => {
      authorGroup = "group-2";
    },
    decide: (role: "head" | "admin" = "head") =>
      decideReopenRequest(prisma, {
        id: "req-1",
        decision: "approved",
        reviewNote: null,
        decidedBy: session.userId,
        session: { ...session, role },
      }),
  };
}

describe("reopen decision current group boundary", () => {
  it("rejects an author moved after the first scoped lookup", async () => {
    const fixture = setup();
    const read = fixture.tx.reopenRequest.findFirst.getMockImplementation();
    if (!read) throw new Error("Missing request reader in test fixture.");
    fixture.tx.reopenRequest.findFirst.mockImplementationOnce(async (input) => {
      const row = await read(input);
      fixture.moveAuthor();
      return row;
    });

    await expect(fixture.decide()).rejects.toBeInstanceOf(
      AdminReopenRequestNotFoundError,
    );
    expect(fixture.tx.reopenRequest.updateMany).not.toHaveBeenCalled();
    expect(fixture.tx.reportSection.updateMany).not.toHaveBeenCalled();
  });

  it("locks participants before Report and rechecks scope before deciding", async () => {
    const fixture = setup();
    await expect(fixture.decide()).resolves.toEqual({
      kind: "decided",
      decision: "approved",
    });
    expect(fixture.events).toEqual([
      "read-request",
      "lock-user:head-1",
      "lock-user:lead-1",
      "lock-report",
      "read-actor",
      "read-request",
      "decide",
    ]);
  });

  it.each([
    { isActive: false, role: "head", reportingGroupId: "group-1" },
    { isActive: true, role: "lead", reportingGroupId: "group-1" },
  ])("rejects revoked actor entitlement: %j", async (actor) => {
    const fixture = setup();
    Object.assign(fixture.actor, actor);
    await expect(fixture.decide()).rejects.toBeInstanceOf(AdminAccessError);
    expect(fixture.tx.reopenRequest.updateMany).not.toHaveBeenCalled();
  });

  it("uses the head's current group instead of the session snapshot", async () => {
    const fixture = setup();
    fixture.actor.reportingGroupId = "group-2";
    await expect(fixture.decide()).rejects.toBeInstanceOf(
      AdminReopenRequestNotFoundError,
    );
    expect(fixture.tx.reopenRequest.updateMany).not.toHaveBeenCalled();
  });

  it("keeps a current admin global after the author's group move", async () => {
    const fixture = setup();
    fixture.actor.role = "admin";
    fixture.moveAuthor();
    await expect(fixture.decide("admin")).resolves.toEqual({
      kind: "decided",
      decision: "approved",
    });
    expect(fixture.tx.reopenRequest.updateMany).toHaveBeenCalledOnce();
  });
});
