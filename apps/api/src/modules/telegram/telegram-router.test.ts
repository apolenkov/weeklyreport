import { describe, expect, it } from "vitest";

import { createAppRouter } from "../../infrastructure/trpc/trpc.router.js";
import { createNullAuditLogger } from "../../lib/audit-logger.js";
import { createNullLogger } from "../../lib/logger.js";

function buildStubRouter(
  deps: Record<string, unknown> = {},
): ReturnType<typeof createAppRouter> {
  const stubDeps = deps as unknown as Parameters<typeof createAppRouter>[0];
  return createAppRouter(stubDeps);
}

describe("admin.testTelegramSend wire-up", () => {
  it("returns INTERNAL_SERVER_ERROR when telegramOutboundQueue is not wired", async () => {
    const router = buildStubRouter();
    // Drive the procedure via the router caller so we exercise the real
    // adminProcedure middleware chain. The stub deps deliberately omit
    // telegramOutboundQueue → expect the documented INTERNAL_SERVER_ERROR.
    const caller = (
      router as unknown as {
        createCaller: (ctx: unknown) => {
          admin: {
            testTelegramSend: (input: {
              chatId: string;
              text: string;
            }) => Promise<unknown>;
          };
        };
      }
    ).createCaller({
      session: {
        userId: "00000000-0000-4000-8000-000000000099",
        email: "admin@customreport.local",
        name: "Admin User",
        role: "admin" as const,
        activeReportId: null,
        activeReportSectionId: null,
      },
      logger: createNullLogger(),
      auditLogger: createNullAuditLogger(),
      ip: "test-ip",
      isPdfExport: false,
      pdfReportId: null,
    });

    await expect(
      caller.admin.testTelegramSend({ chatId: "12345", text: "hello" }),
    ).rejects.toThrow(/telegram outbound queue is not wired/i);
  });
});

describe("admin.integrationsStatus wire-up", () => {
  it("returns the service result through an authenticated caller", async () => {
    const expected = { telegram: { configured: false, bindings: 2 } };
    const router = buildStubRouter({
      env: {},
      snapshotAdminService: {
        integrationsStatus: () => Promise.resolve(expected),
      },
    });
    const caller = router.createCaller({
      session: {
        userId: "00000000-0000-4000-8000-000000000099",
        email: "admin@customreport.local",
        name: "Admin User",
        role: "admin",
        activeReportId: null,
        activeReportSectionId: null,
      },
      logger: createNullLogger(),
      auditLogger: createNullAuditLogger(),
      ip: "test-ip",
      isPdfExport: false,
      pdfReportId: null,
    });

    await expect(caller.admin.integrationsStatus()).resolves.toEqual(expected);
  });
});
