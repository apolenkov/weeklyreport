import type { UserSession } from "@weeklyreport/shared";
import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import type { AuditLogger } from "../../lib/audit-logger.js";
import { createNullLogger } from "../../lib/logger.js";
import { createNullAuditLogger } from "../../test-utils/audit-logger.js";
import { auditPersistFailuresTotal } from "../metrics/metrics.registry.js";
import {
  captureMutationAuditInputMiddleware,
  protectedProcedure,
  router,
} from "./trpc.middleware.js";

const leadSession: UserSession = {
  userId: "u1",
  email: "lead@test.com",
  name: "Lead User",
  role: "lead",
  activeReportId: "r1",
  activeReportSectionId: "s1",
};

const testRouter = router({
  saveDraft: protectedProcedure
    .input(z.object({ sectionId: z.string() }))
    .use(captureMutationAuditInputMiddleware)
    .mutation(() => "saved"),
});

function caller(overrides: {
  readonly auditLogger?: AuditLogger;
  readonly logger?: ReturnType<typeof createNullLogger>;
  readonly create?: () => Promise<unknown>;
}) {
  return testRouter.createCaller({
    session: leadSession,
    logger: overrides.logger ?? createNullLogger(),
    auditLogger: overrides.auditLogger ?? createNullAuditLogger(),
    prisma: {
      userActionLog: {
        create: overrides.create ?? (() => Promise.resolve({})),
      },
    } as never,
    ip: "test-ip",
    isPdfExport: false,
    pdfReportId: null,
  });
}

// TASK-503.32 (C0540, C0558). trpc.audit.ts documents the durable half as
// best-effort: "audit bookkeeping cannot fail the mutation that already
// succeeded". These tests state that contract for the failures of the audit
// reporting itself. The throwing sinks are fault injections, not an admitted
// production path; the policy is confirmed by the API owner (see the change).
describe("audit reporting failures never replace the mutation outcome", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("control: the mutation succeeds when no audit sink fails", async () => {
    await expect(caller({}).saveDraft({ sectionId: "sec-42" })).resolves.toBe(
      "saved",
    );
  });

  it("keeps a succeeded mutation when the audit log stream throws (C0558)", async () => {
    const auditLogger: AuditLogger = {
      ...createNullAuditLogger(),
      mutation: () => {
        throw new Error("audit sink unavailable");
      },
    };

    await expect(
      caller({ auditLogger }).saveDraft({ sectionId: "sec-42" }),
    ).resolves.toBe("saved");
  });

  it("keeps a succeeded mutation when the drop metric throws after a persist failure (C0540)", async () => {
    vi.spyOn(auditPersistFailuresTotal, "inc").mockImplementation(() => {
      throw new Error("metric registry unavailable");
    });

    await expect(
      caller({
        create: () => Promise.reject(new Error("db unavailable")),
      }).saveDraft({ sectionId: "sec-42" }),
    ).resolves.toBe("saved");
  });

  it("keeps a succeeded mutation when the error logger throws after a persist failure (C0540)", async () => {
    const logger = {
      ...createNullLogger(),
      error: () => {
        throw new Error("log transport unavailable");
      },
    };

    await expect(
      caller({
        logger,
        create: () => Promise.reject(new Error("db unavailable")),
      }).saveDraft({ sectionId: "sec-42" }),
    ).resolves.toBe("saved");
  });
});
