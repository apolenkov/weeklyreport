import { describe, expect, it, vi } from "vitest";

import {
  ControlActionRecoveryError,
  recoverControlAction,
} from "./control-recovery.ts";

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
});
