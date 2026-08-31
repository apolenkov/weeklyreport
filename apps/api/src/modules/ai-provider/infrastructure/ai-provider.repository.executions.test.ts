import { describe, expect, it, vi } from "vitest";

import type { PrismaService } from "../../../infrastructure/prisma/prisma.service.js";
import {
  completeProviderTestExecution,
  createOrReuseProviderExecution,
  startProviderTestExecution,
} from "./ai-provider.repository.executions.js";

describe("provider test execution identity", () => {
  it("claims a queued execution with its BullMQ processing-attempt token", async () => {
    interface UpdateInput {
      where: { id: string; state: "queued" };
      data: { state: "running"; startedAt: Date; executionAttempt: number };
    }
    const updateMany = vi
      .fn<(input: UpdateInput) => Promise<{ count: number }>>()
      .mockResolvedValue({ count: 1 });
    const prisma = {
      aiProviderTestExecution: { updateMany },
    } as unknown as PrismaService;

    await expect(
      startProviderTestExecution(prisma, "execution-queued", 1),
    ).resolves.toBe(true);
    const input = updateMany.mock.calls.at(0)?.[0];
    expect(input?.where).toEqual({
      id: "execution-queued",
      state: "queued",
    });
    expect(input?.data.state).toBe("running");
    expect(input?.data.startedAt).toBeInstanceOf(Date);
    expect(input?.data.executionAttempt).toBe(1);
  });

  it("reclaims a running execution only for a later BullMQ processing attempt", async () => {
    interface ReclaimInput {
      where: {
        id: string;
        state: "queued" | "running";
        executionAttempt?: { lt: number };
      };
      data: {
        state?: "running";
        startedAt: Date;
        executionAttempt: number;
      };
    }
    const updateMany = vi
      .fn<(input: ReclaimInput) => Promise<{ count: number }>>()
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 1 });
    const prisma = {
      aiProviderTestExecution: { updateMany },
    } as unknown as PrismaService;

    await expect(
      startProviderTestExecution(prisma, "execution-stalled", 2),
    ).resolves.toBe(true);

    const reclaimInput = updateMany.mock.calls.at(1)?.[0];
    expect(reclaimInput?.where).toEqual({
      id: "execution-stalled",
      state: "running",
      executionAttempt: { lt: 2 },
    });
    expect(reclaimInput?.data.executionAttempt).toBe(2);
    expect(reclaimInput?.data.startedAt).toBeInstanceOf(Date);
  });

  it("refuses a late claimant from completing a newer processing attempt", async () => {
    interface CompleteInput {
      where: { id: string; state: "running"; executionAttempt: number };
      data: {
        state: "completed";
        outcome: "passed";
        failureCode: null;
        checks: [];
        completedAt: Date;
      };
    }
    const updateMany = vi
      .fn<(input: CompleteInput) => Promise<{ count: number }>>()
      .mockResolvedValue({ count: 0 });
    const prisma = {
      aiProviderTestExecution: { updateMany },
    } as unknown as PrismaService;

    await expect(
      completeProviderTestExecution(
        prisma,
        "execution-stalled",
        "passed",
        null,
        [],
        1,
      ),
    ).resolves.toBe(false);

    const completionInput = updateMany.mock.calls.at(0)?.[0];
    expect(completionInput?.where).toEqual({
      id: "execution-stalled",
      state: "running",
      executionAttempt: 1,
    });
    expect(completionInput?.data).toMatchObject({
      state: "completed",
      outcome: "passed",
      failureCode: null,
      checks: [],
    });
    expect(completionInput?.data.completedAt).toBeInstanceOf(Date);
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

  it("creates a fresh execution for an explicit retest after a passed run", async () => {
    const create = vi.fn().mockResolvedValue({ id: "execution-retest" });
    const prisma = {
      aiProviderConfiguration: {
        findUnique: vi.fn().mockResolvedValue({
          compositeTestIdentity: "shared-composite",
        }),
      },
      aiProviderTestExecution: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "execution-passed",
            outcome: "passed",
            state: "completed",
            testSuiteVersion: "provider-test-v1",
          },
        ]),
        findUnique: vi.fn().mockResolvedValue(null),
        create,
      },
    } as unknown as PrismaService;

    await expect(
      createOrReuseProviderExecution(prisma, "revision-passed", {
        testSuiteVersion: "provider-test-v1",
      }),
    ).resolves.toEqual({
      id: "execution-retest",
      created: true,
      state: "queued",
    });
    expect(create).toHaveBeenCalledWith({
      data: {
        identity: "shared-composite:revision:revision-passed:retry:1",
        providerRevisionId: "revision-passed",
        testSuiteVersion: "provider-test-v1",
      },
      select: { id: true },
    });
  });

  it("does not reuse evidence from an older capability suite", async () => {
    const create = vi.fn().mockResolvedValue({ id: "execution-new-suite" });
    const prisma = {
      aiProviderConfiguration: {
        findUnique: vi.fn().mockResolvedValue({
          compositeTestIdentity: "shared-composite",
        }),
      },
      aiProviderTestExecution: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "execution-old-suite",
            outcome: "passed",
            state: "completed",
            testSuiteVersion: "provider-test-v1",
          },
        ]),
        findUnique: vi.fn().mockResolvedValue(null),
        create,
      },
    } as unknown as PrismaService;

    await expect(
      createOrReuseProviderExecution(prisma, "revision-suite", {
        testSuiteVersion: "provider-test-v2",
      }),
    ).resolves.toEqual({
      id: "execution-new-suite",
      created: true,
      state: "queued",
    });
    expect(create).toHaveBeenCalledWith({
      data: {
        identity: "shared-composite:revision:revision-suite:retry:1",
        providerRevisionId: "revision-suite",
        testSuiteVersion: "provider-test-v2",
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
