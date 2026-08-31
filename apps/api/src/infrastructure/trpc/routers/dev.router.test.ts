import type { PrismaClient } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { createNullLogger } from "../../../lib/logger.js";
import { createNullAuditLogger } from "../../../test-utils/audit-logger.js";
import type { EnvConfig } from "../../config/env.schema";
import { createDevRouter } from "./dev.router.js";

const session = {
  userId: "10000000-0000-4000-8000-000000000005",
  email: "dev@test.local",
  name: "Dev",
  role: "admin" as const,
  activeReportId: null,
  activeReportSectionId: null,
};

function buildCaller(authDevMode: boolean) {
  const env = { AUTH_DEV_MODE: authDevMode } as EnvConfig;
  const router = createDevRouter({
    prisma: {} as unknown as PrismaClient,
    env,
  });
  return router.createCaller({
    session,
    logger: createNullLogger(),
    auditLogger: createNullAuditLogger(),
    ip: "test-ip",
    isPdfExport: false,
    pdfReportId: null,
  });
}

describe("dev.wipeAndReseed — variant is required, never defaulted", () => {
  it("rejects a call that omits variant at input validation (BAD_REQUEST), not by running the wipe", async () => {
    const caller = buildCaller(false);

    await expect(caller.wipeAndReseed({} as never)).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });

  it("still gates on dev mode once variant IS supplied (FORBIDDEN, not BAD_REQUEST)", async () => {
    const caller = buildCaller(false);

    await expect(
      caller.wipeAndReseed({ variant: "minimal" }),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "Dev mode is not enabled",
    });
  });
});
