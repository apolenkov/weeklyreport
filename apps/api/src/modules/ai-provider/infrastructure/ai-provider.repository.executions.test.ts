import { describe, expect, it, vi } from "vitest";

import type { PrismaService } from "../../../infrastructure/prisma/prisma.service.js";
import {
  createOrReuseProviderExecution,
  updateProviderExecutionIdentity,
} from "./ai-provider.repository.executions.js";

describe("provider compatibility execution identity", () => {
  it("preserves the retry suffix when the measured composite identity changes", async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const prisma = {
      aiCompatibilityExecution: {
        findUnique: vi.fn().mockResolvedValue({
          identity: "old-composite:revision:revision-failed:retry:1",
        }),
        updateMany,
      },
    } as unknown as PrismaService;

    await expect(
      updateProviderExecutionIdentity(
        prisma,
        "execution-retry",
        "measured-composite",
        "revision-failed",
      ),
    ).resolves.toBe(true);
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: "execution-retry", kind: "provider_test" },
      data: {
        identity: "measured-composite:revision:revision-failed:retry:1",
      },
    });
  });

  it("creates a retry for a completed incompatible execution", async () => {
    const create = vi.fn().mockResolvedValue({ id: "execution-retry" });
    const prisma = {
      aiProviderConfiguration: {
        findUnique: vi.fn().mockResolvedValue({
          compositeTestIdentity: "shared-composite",
        }),
      },
      aiCompatibilityExecution: {
        findMany: vi
          .fn()
          .mockResolvedValue([
            { id: "execution-failed", outcome: "incompatible" },
          ]),
        findUnique: vi.fn().mockResolvedValue(null),
        create,
      },
    } as unknown as PrismaService;

    await expect(
      createOrReuseProviderExecution(prisma, "revision-failed", {
        evaluatorVersion: "provider-compatibility-v5",
      }),
    ).resolves.toEqual({ id: "execution-retry", created: true });
    expect(create).toHaveBeenCalledWith({
      data: {
        identity: "shared-composite:revision:revision-failed:retry:1",
        kind: "provider_test",
        providerRevisionId: "revision-failed",
        evaluatorVersion: "provider-compatibility-v5",
      },
      select: { id: true },
    });
  });

  it("creates a new run for a new revision with the same composite fingerprint", async () => {
    const findMany = vi.fn((input: unknown) => {
      const serialized = JSON.stringify(input);
      return Promise.resolve(
        serialized.includes(":revision:revision-new")
          ? []
          : [{ id: "execution-old", outcome: "configuration_error" }],
      );
    });
    const create = vi.fn().mockResolvedValue({ id: "execution-new" });
    const prisma = {
      aiProviderConfiguration: {
        findUnique: vi.fn().mockResolvedValue({
          compositeTestIdentity: "shared-composite",
        }),
      },
      aiCompatibilityExecution: {
        findMany,
        findUnique: vi.fn().mockResolvedValue(null),
        create,
      },
    } as unknown as PrismaService;

    await expect(
      createOrReuseProviderExecution(prisma, "revision-new", {
        evaluatorVersion: "provider-compatibility-v5",
      }),
    ).resolves.toEqual({ id: "execution-new", created: true });
    expect(create).toHaveBeenCalledWith({
      data: {
        identity: "shared-composite:revision:revision-new",
        kind: "provider_test",
        providerRevisionId: "revision-new",
        evaluatorVersion: "provider-compatibility-v5",
      },
      select: { id: true },
    });
  });
});
