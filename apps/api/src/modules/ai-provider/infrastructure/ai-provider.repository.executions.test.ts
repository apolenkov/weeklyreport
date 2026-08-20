import { describe, expect, it, vi } from "vitest";

import type { PrismaService } from "../../../infrastructure/prisma/prisma.service.js";
import {
  createOrReuseProviderExecution,
  startProviderTestExecution,
  updateProviderTestExecutionIdentity,
} from "./ai-provider.repository.executions.js";

describe("provider test execution identity", () => {
  it("claims only queued executions", async () => {
    interface UpdateInput {
      where: { id: string; state: "queued" };
      data: { state: "running"; startedAt: Date };
    }
    const updateMany = vi
      .fn<(input: UpdateInput) => Promise<{ count: number }>>()
      .mockResolvedValue({ count: 0 });
    const prisma = {
      aiProviderTestExecution: { updateMany },
    } as unknown as PrismaService;

    await expect(
      startProviderTestExecution(prisma, "execution-running"),
    ).resolves.toBe(false);
    const input = updateMany.mock.calls.at(0)?.[0];
    expect(input?.where).toEqual({
      id: "execution-running",
      state: "queued",
    });
    expect(input?.data.state).toBe("running");
    expect(input?.data.startedAt).toBeInstanceOf(Date);
  });

  it("preserves the retry suffix when the measured composite identity changes", async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const prisma = {
      aiProviderTestExecution: {
        findUnique: vi.fn().mockResolvedValue({
          identity: "old-composite:revision:revision-failed:retry:1",
        }),
        updateMany,
      },
    } as unknown as PrismaService;

    await expect(
      updateProviderTestExecutionIdentity(
        prisma,
        "execution-retry",
        "measured-composite",
        "revision-failed",
      ),
    ).resolves.toBe(true);
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: "execution-retry" },
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
      aiProviderTestExecution: {
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
        testSuiteVersion: "provider-test-v1",
      }),
    ).resolves.toEqual({
      id: "execution-retry",
      created: true,
      state: "queued",
    });
    expect(create).toHaveBeenCalledWith({
      data: {
        identity: "shared-composite:revision:revision-failed:retry:1",
        providerRevisionId: "revision-failed",
        testSuiteVersion: "provider-test-v1",
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
      aiProviderTestExecution: {
        findMany,
        findUnique: vi.fn().mockResolvedValue(null),
        create,
      },
    } as unknown as PrismaService;

    await expect(
      createOrReuseProviderExecution(prisma, "revision-new", {
        testSuiteVersion: "provider-test-v1",
      }),
    ).resolves.toEqual({
      id: "execution-new",
      created: true,
      state: "queued",
    });
    expect(create).toHaveBeenCalledWith({
      data: {
        identity: "shared-composite:revision:revision-new",
        providerRevisionId: "revision-new",
        testSuiteVersion: "provider-test-v1",
      },
      select: { id: true },
    });
  });
});
