import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  ControlActionRecoveryError,
  recoverControlAction,
} from "./control-recovery.ts";

beforeEach(() => {
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION", "давай");
});

afterEach(() => vi.unstubAllEnvs());

describe("control action recovery", () => {
  it("performs one reseed and one baseline oracle check", async () => {
    const reseed = vi.fn(() => Promise.resolve());
    const assertBaseline = vi.fn(() => Promise.resolve());

    await recoverControlAction({
      databaseUrl: "postgresql://localhost/customreport_e2e",
      resetAndReseed: reseed,
      assertBaseline,
    });

    expect(reseed).toHaveBeenCalledOnce();
    expect(assertBaseline).toHaveBeenCalledOnce();
  });

  it("fails closed when reseed or the baseline oracle fails", async () => {
    const error = new Error("reseed failed");

    await expect(
      recoverControlAction({
        databaseUrl: "postgresql://localhost/customreport_e2e",
        resetAndReseed: () => Promise.reject(error),
        assertBaseline: () => Promise.resolve(),
      }),
    ).rejects.toBeInstanceOf(ControlActionRecoveryError);
  });

  it("rejects an unsafe target before invoking recovery", async () => {
    const reseed = vi.fn(() => Promise.resolve());
    const assertBaseline = vi.fn(() => Promise.resolve());

    await expect(
      recoverControlAction({
        databaseUrl: "postgresql://localhost/customreport_dev",
        resetAndReseed: reseed,
        assertBaseline,
      }),
    ).rejects.toThrow(/not one of/u);
    expect(reseed).not.toHaveBeenCalled();
    expect(assertBaseline).not.toHaveBeenCalled();
  });

  it("rejects the same physical database before invoking recovery", async () => {
    vi.stubEnv(
      "DATABASE_URL",
      "postgresql://developer:credentials@localhost:5432/customreport_e2e",
    );
    const reseed = vi.fn(() => Promise.resolve());

    await expect(
      recoverControlAction({
        databaseUrl: "postgres://runtime:other@127.0.0.1:5432/customreport_e2e",
        resetAndReseed: reseed,
        assertBaseline: () => Promise.resolve(),
      }),
    ).rejects.toThrow(/must differ/iu);
    expect(reseed).not.toHaveBeenCalled();
  });
});
