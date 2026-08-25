import type { UserSession } from "@customreport/shared";
import { TRPCError } from "@trpc/server";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { createNullAuditLogger } from "../../lib/audit-logger.js";
import { createNullLogger } from "../../lib/logger.js";
import { leadProcedure, router } from "./trpc.middleware.js";

const PRIVATE_INPUT = {
  id: "safe-target-id",
  reportText: "confidential weekly summary",
  reviewComment: "private head review",
  profileName: "Sensitive Person",
  telegramContent: "private Telegram message",
  telegramChatId: "chat-998877",
  credential: "password-secret",
  token: "bearer-secret-token",
  cookie: "session=private-cookie",
  body: "raw transport body",
} as const;

const PRIVATE_VALUES = Object.values(PRIVATE_INPUT).filter(
  (value) => value !== PRIVATE_INPUT.id,
);

const privateInputSchema = z.object({
  id: z.string(),
  reportText: z.string(),
  reviewComment: z.string(),
  profileName: z.string(),
  telegramContent: z.string(),
  telegramChatId: z.string(),
  credential: z.string(),
  token: z.string(),
  cookie: z.string(),
  body: z.string(),
});

const privacyRouter = router({
  succeeds: leadProcedure.input(privateInputSchema).mutation(() => "ok"),
  fails: leadProcedure.input(privateInputSchema).mutation(({ input }) => {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: [
        input.reportText,
        input.reviewComment,
        input.profileName,
        input.telegramContent,
        input.telegramChatId,
        input.credential,
        input.token,
        input.cookie,
        input.body,
        'Prisma.reportSection.create({ data: "internal-db-metadata" })',
      ].join(" | "),
    });
  }),
});

const SESSION: UserSession = {
  userId: "00000000-0000-4000-8000-000000000001",
  email: "lead@test.local",
  name: "Lead User",
  role: "lead",
};

function makeCaller() {
  const mutation = vi.fn();
  const create = vi.fn(() => Promise.resolve({}));
  const auditLogger = { ...createNullAuditLogger(), mutation };
  const caller = privacyRouter.createCaller({
    session: SESSION,
    logger: createNullLogger(),
    auditLogger,
    prisma: { userActionLog: { create } } as never,
    correlationId: "privacy-request-1",
    ip: "127.0.0.1",
    isPdfExport: false,
    pdfReportId: null,
  });
  return { caller, create, mutation };
}

function expectPrivateValuesAbsent(value: unknown): void {
  const serialized = JSON.stringify(value);
  for (const privateValue of PRIVATE_VALUES) {
    expect(serialized).not.toContain(privateValue);
  }
  expect(serialized).not.toContain("internal-db-metadata");
}

describe("mutation audit privacy boundary", () => {
  it("retains only target metadata for a successful mutation", async () => {
    const { caller, create, mutation } = makeCaller();

    await caller.succeeds(PRIVATE_INPUT);

    expect(mutation).toHaveBeenCalledWith(
      expect.objectContaining({
        target: PRIVATE_INPUT.id,
        status: "success",
      }),
    );
    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        targetId: PRIVATE_INPUT.id,
        status: "success",
        reason: null,
      }) as unknown,
    });
    expectPrivateValuesAbsent(mutation.mock.calls);
    expectPrivateValuesAbsent(create.mock.calls);
  });

  it("stores only the fixed failure code when an error echoes private values", async () => {
    const { caller, create, mutation } = makeCaller();

    await expect(caller.fails(PRIVATE_INPUT)).rejects.toThrow();

    expect(mutation).toHaveBeenCalledWith(
      expect.objectContaining({ status: "fail", reason: "BAD_REQUEST" }),
    );
    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        status: "fail",
        reason: "BAD_REQUEST",
      }) as unknown,
    });
    expectPrivateValuesAbsent(mutation.mock.calls);
    expectPrivateValuesAbsent(create.mock.calls);
  });
});
