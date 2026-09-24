import type { PrismaClient } from "@prisma/client";
import { afterEach, describe, expect, it, vi } from "vitest";

// The destructive child process is mocked: these cases prove WHEN the reset may
// spawn, and no test in this file ever runs a real reset.
type ExecFileSyncCall = (
  file: string,
  args: readonly string[],
  options: { readonly env?: NodeJS.ProcessEnv },
) => string;

const { execFileSyncMock } = vi.hoisted(() => ({
  execFileSyncMock: vi.fn<ExecFileSyncCall>(() => "ok"),
}));

vi.mock("node:child_process", () => ({
  execFileSync: execFileSyncMock,
}));

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

const DISPOSABLE_URL =
  "postgresql://customreport:localdev@localhost:5432/customreport_e2e";
const NON_DISPOSABLE_URL =
  "postgresql://customreport:localdev@db.example.com:5432/customreport";

function buildCaller(
  authDevMode: boolean,
  databaseUrl: string = DISPOSABLE_URL,
) {
  const env = {
    AUTH_DEV_MODE: authDevMode,
    DATABASE_URL: databaseUrl,
  } as EnvConfig;
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

afterEach(() => {
  execFileSyncMock.mockClear();
  vi.unstubAllEnvs();
});

describe("dev.wipeAndReseed — destructive guard runs before the first spawn", () => {
  it("refuses a non-disposable target before any child process", async () => {
    vi.stubEnv("PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION", "давай");
    const caller = buildCaller(true, NON_DISPOSABLE_URL);

    await expect(
      caller.wipeAndReseed({ variant: "minimal" }),
    ).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
    expect(execFileSyncMock).not.toHaveBeenCalled();
  });

  it("refuses a run without the operator's per-run consent", async () => {
    vi.stubEnv("PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION", "");
    const caller = buildCaller(true);

    await expect(
      caller.wipeAndReseed({ variant: "minimal" }),
    ).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
    expect(execFileSyncMock).not.toHaveBeenCalled();
  });

  it("reaches the reset spawn for a consented disposable E2E target", async () => {
    vi.stubEnv("PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION", "давай");
    const caller = buildCaller(true);

    await expect(
      caller.wipeAndReseed({ variant: "minimal" }),
    ).resolves.toMatchObject({ ok: true, variant: "minimal" });

    expect(execFileSyncMock).toHaveBeenCalledTimes(2);
    expect(execFileSyncMock.mock.calls[0]?.[1]).toEqual([
      "exec",
      "prisma",
      "migrate",
      "reset",
      "--force",
    ]);
    // Consent is inherited from the operator environment, never injected.
    const options = execFileSyncMock.mock.calls[0]?.[2];
    if (options === undefined) throw new TypeError("expected spawn options");
    expect(options.env).toBe(process.env);
  });
});

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
