import type { PrismaClient } from "@prisma/client";
import { afterEach, describe, expect, it, vi } from "vitest";

// The destructive child process is mocked: these cases prove WHEN the reset may
// spawn, and no test in this file ever runs a real reset.
type ExecFileCall = (
  file: string,
  args: readonly string[],
  options: { readonly env?: NodeJS.ProcessEnv },
) => Promise<{ stdout: string; stderr: string }>;

const { execFileMock } = vi.hoisted(() => ({
  execFileMock: vi.fn<ExecFileCall>(() =>
    Promise.resolve({ stdout: "ok", stderr: "" }),
  ),
}));

// promisify(execFile) resolves through the util.promisify.custom hook.
vi.mock("node:child_process", () => ({
  execFile: Object.assign(vi.fn(), {
    [Symbol.for("nodejs.util.promisify.custom")]: execFileMock,
  }),
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
  "postgresql://customreport:localdev@db.internal:5432/customreport";

function buildCaller(
  authDevMode: boolean,
  databaseUrl: string = DISPOSABLE_URL,
  runtime: { prisma?: PrismaClient; redisDb?: number } = {},
) {
  const env = {
    AUTH_DEV_MODE: authDevMode,
    DATABASE_URL: databaseUrl,
    REDIS_DB: runtime.redisDb,
  } as EnvConfig;
  const router = createDevRouter({
    prisma: runtime.prisma ?? ({} as unknown as PrismaClient),
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
  execFileMock.mockClear();
  vi.unstubAllEnvs();
});

describe("dev.wipeAndReseed — destructive guard runs before the first spawn", () => {
  it("refuses a non-disposable target before any child process", async () => {
    vi.stubEnv("PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION", "давай");
    const caller = buildCaller(true, NON_DISPOSABLE_URL);

    await expect(
      caller.wipeAndReseed({ variant: "minimal" }),
    ).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
    expect(execFileMock).not.toHaveBeenCalled();
  });

  it("refuses a run without the operator's per-run consent", async () => {
    vi.stubEnv("PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION", "");
    const caller = buildCaller(true);

    await expect(
      caller.wipeAndReseed({ variant: "minimal" }),
    ).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
    expect(execFileMock).not.toHaveBeenCalled();
  });

  it("reaches the reset spawn for a consented disposable E2E target", async () => {
    vi.stubEnv("PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION", "давай");
    const caller = buildCaller(true);

    await expect(
      caller.wipeAndReseed({ variant: "minimal" }),
    ).resolves.toMatchObject({ ok: true, variant: "minimal" });

    expect(execFileMock).toHaveBeenCalledTimes(2);
    expect(execFileMock.mock.calls[0]?.[1]).toEqual([
      "exec",
      "prisma",
      "migrate",
      "reset",
      "--force",
    ]);
    // Consent is inherited from the operator environment, never injected.
    const options = execFileMock.mock.calls[0]?.[2];
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

describe("dev.wipeAndReseed — one reseed at a time", () => {
  it("rejects a concurrent call and accepts a new one after completion", async () => {
    vi.stubEnv("PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION", "давай");
    const caller = buildCaller(true);
    let release: () => void = () => undefined;
    execFileMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          release = () => resolve({ stdout: "ok", stderr: "" });
        }),
    );

    const first = caller.wipeAndReseed({ variant: "minimal" });
    await expect(
      caller.wipeAndReseed({ variant: "minimal" }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    release();
    await expect(first).resolves.toMatchObject({ ok: true });
    await expect(
      caller.wipeAndReseed({ variant: "minimal" }),
    ).resolves.toMatchObject({ ok: true });
  });

  it("releases the flag when the reset fails", async () => {
    vi.stubEnv("PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION", "давай");
    const caller = buildCaller(true);
    execFileMock.mockRejectedValueOnce(new Error("boom"));

    await expect(
      caller.wipeAndReseed({ variant: "minimal" }),
    ).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
    await expect(
      caller.wipeAndReseed({ variant: "minimal" }),
    ).resolves.toMatchObject({ ok: true });
  });
});

describe("dev.runtimeTarget — observable database and Redis DB", () => {
  const prismaReturning = (rows: unknown[]) =>
    ({
      $queryRaw: vi.fn(() => Promise.resolve(rows)),
    }) as unknown as PrismaClient;

  it("reports the connected database and the configured Redis DB", async () => {
    const caller = buildCaller(true, DISPOSABLE_URL, {
      prisma: prismaReturning([{ database: "customreport_e2e" }]),
      redisDb: 15,
    });

    await expect(caller.runtimeTarget()).resolves.toEqual({
      database: "customreport_e2e",
      redisDb: 15,
    });
  });

  it("is refused outside dev mode", async () => {
    const caller = buildCaller(false);

    await expect(caller.runtimeTarget()).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("fails when the database cannot name itself", async () => {
    const caller = buildCaller(true, DISPOSABLE_URL, {
      prisma: prismaReturning([]),
      redisDb: 15,
    });

    await expect(caller.runtimeTarget()).rejects.toMatchObject({
      code: "INTERNAL_SERVER_ERROR",
    });
  });
});
