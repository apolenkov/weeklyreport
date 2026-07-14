import { describe, expect, it } from "vitest";

import { createAppRouter } from "../../infrastructure/trpc/trpc.router.js";

// Build the AppRouter with stub deps for surface-shape assertions. We never
// invoke a resolver in this file; the resolver bodies are covered by the
// shared schema + adapter unit tests. This file pins the router contract so
// the procedures exist at the expected path.
function buildStubRouter() {
  const stubDeps = {} as Parameters<typeof createAppRouter>[0];
  return createAppRouter(stubDeps);
}

describe("admin.integrationsStatus + admin.testTelegramSend", () => {
  it("exposes admin.integrationsStatus as a leaf procedure", () => {
    const router = buildStubRouter();
    const procedures = (
      router as unknown as {
        _def: { procedures: Record<string, unknown> };
      }
    )._def.procedures;
    expect(procedures["admin.integrationsStatus"]).toBeDefined();
  });

  it("exposes admin.testTelegramSend as a leaf procedure", () => {
    const router = buildStubRouter();
    const procedures = (
      router as unknown as {
        _def: { procedures: Record<string, unknown> };
      }
    )._def.procedures;
    expect(procedures["admin.testTelegramSend"]).toBeDefined();
  });
});

describe("admin.testTelegramSend wire-up", () => {
  it("returns INTERNAL_SERVER_ERROR when telegramOutboundQueue is not wired", async () => {
    const router = buildStubRouter();
    // Drive the procedure via the router caller so we exercise the real
    // adminProcedure middleware chain. The stub deps deliberately omit
    // telegramOutboundQueue → expect the documented INTERNAL_SERVER_ERROR.
    const nullLogger = {
      info: () => undefined,
      warn: () => undefined,
      error: () => undefined,
      debug: () => undefined,
      verbose: () => undefined,
      fatal: () => undefined,
    } as const;
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
      logger: nullLogger,
      auditLogger: {
        mutation: () => undefined,
      },
      ip: "test-ip",
      isPdfExport: false,
      pdfReportId: null,
    });

    await expect(
      caller.admin.testTelegramSend({ chatId: "12345", text: "hello" }),
    ).rejects.toThrow(/telegram outbound queue is not wired/i);
  });
});
