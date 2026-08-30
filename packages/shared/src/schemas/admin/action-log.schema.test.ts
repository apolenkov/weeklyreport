import { describe, expect, expectTypeOf, it } from "vitest";

import {
  type AdminActionLogEvent,
  adminActionLogEventSchema,
  adminActionLogPageSchema,
} from "../../index";

const SUCCESS_EVENT = {
  id: "action-1",
  createdAt: "2026-08-14T10:15:30.000Z",
  userId: "user-1",
  role: "admin",
  procedure: "admin.updateUser",
  targetId: null,
  status: "success",
  reason: null,
  ip: null,
  correlationId: "request-1",
  durationMs: 12,
} as const;

describe("adminActionLogEventSchema", () => {
  it("accepts the complete success allowlist and freezes the projection", () => {
    const event = adminActionLogEventSchema.parse(SUCCESS_EVENT);

    expect(event).toEqual(SUCCESS_EVENT);
    expect(Object.isFrozen(event)).toBe(true);
    expectTypeOf(event).toEqualTypeOf<AdminActionLogEvent>();
  });

  it.each([
    "BAD_REQUEST",
    "INTERNAL_SERVER_ERROR",
    "TOO_MANY_REQUESTS",
    "CLIENT_CLOSED_REQUEST",
  ] as const)("accepts the bounded failure classification %s", (reason) => {
    expect(
      adminActionLogEventSchema.parse({
        ...SUCCESS_EVENT,
        status: "fail",
        reason,
        role: "viewer",
        targetId: "report-1",
        ip: "127.0.0.1",
      }),
    ).toMatchObject({ status: "fail", reason });
  });

  it.each([
    ["unknown property", { ...SUCCESS_EVENT, payload: { secret: true } }],
    ["arbitrary reason", { ...SUCCESS_EVENT, status: "fail", reason: "boom" }],
    ["success reason", { ...SUCCESS_EVENT, reason: "BAD_REQUEST" }],
    ["missing failure reason", { ...SUCCESS_EVENT, status: "fail" }],
    ["malformed timestamp", { ...SUCCESS_EVENT, createdAt: "14.08.2026" }],
    ["invalid status", { ...SUCCESS_EVENT, status: "failure" }],
    ["invalid role", { ...SUCCESS_EVENT, role: "director" }],
  ])("rejects %s", (_label, candidate) => {
    expect(adminActionLogEventSchema.safeParse(candidate).success).toBe(false);
  });
});

describe("adminActionLogPageSchema", () => {
  it("accepts nullable continuation and freezes the item collection", () => {
    const page = adminActionLogPageSchema.parse({
      items: [SUCCESS_EVENT],
      nextCursor: null,
    });

    expect(page.nextCursor).toBeNull();
    expect(Object.isFrozen(page)).toBe(true);
    expect(Object.isFrozen(page.items)).toBe(true);
    expect(Object.isFrozen(page.items[0])).toBe(true);
    expectTypeOf(page.items).toEqualTypeOf<readonly AdminActionLogEvent[]>();
  });

  it("rejects page properties outside the public contract", () => {
    expect(
      adminActionLogPageSchema.safeParse({
        items: [SUCCESS_EVENT],
        nextCursor: "action-1",
        total: 1,
      }).success,
    ).toBe(false);
  });
});
