import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { runtimeLaneResources } from "../contracts/runtime-lane-contract.ts";
import { recreateRuntimeLaneRedisInfrastructure } from "./runtime-lane-redis-container.ts";

describe("runtime lane Redis destructive guard", () => {
  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("RUNTIME_SWEEP_REDIS_RECREATE", "true");
  });
  afterEach(() => vi.unstubAllEnvs());

  it.each([
    [
      "unsafe database",
      "postgresql://user:secret@127.0.0.1/customreport_test",
      "давай",
    ],
    [
      "missing consent",
      "postgresql://user:secret@127.0.0.1/customreport_e2e",
      undefined,
    ],
  ] as const)(
    "rejects %s before Docker discovery or mutation",
    async (_label, databaseUrl, consent) => {
      vi.stubEnv("E2E_DATABASE_URL", databaseUrl);
      vi.stubEnv("PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION", consent ?? "");
      const names = vi.fn(() => Promise.resolve([]));
      const execute = vi.fn(() => Promise.resolve(""));

      await expect(
        recreateRuntimeLaneRedisInfrastructure(runtimeLaneResources(1), {
          names,
          inspect: vi.fn(),
          execute,
          wait: vi.fn(() => Promise.resolve()),
        }),
      ).rejects.toThrow(/Refusing E2E\/runtime destructive operation/u);
      expect(names).not.toHaveBeenCalled();
      expect(execute).not.toHaveBeenCalled();
    },
  );
});
