import { describe, expect, it, vi } from "vitest";

import { ActionLogPrismaRepository } from "./action-log.prisma-repository.js";
import {
  type ActionLogRepository,
  ActionLogService,
} from "./action-log.service.js";

const ROW = {
  id: "log-1",
  userId: "user-1",
  role: "lead" as const,
  procedure: "saveDraft",
  targetId: "sec-1",
  status: "success" as const,
  reason: null,
  ip: "127.0.0.1",
  correlationId: "corr-1",
  durationMs: 12,
  createdAt: new Date("2026-07-01T00:00:00.000Z"),
};

describe("ActionLogService.list", () => {
  it("requests limit+1 rows and serializes createdAt to ISO", async () => {
    const listActionLog = vi.fn().mockResolvedValue([ROW]);
    const repository: ActionLogRepository = { listActionLog };
    const service = new ActionLogService(repository);

    const page = await service.list({ limit: 20 });

    expect(listActionLog).toHaveBeenCalledWith({
      limit: 21,
      cursor: undefined,
    });
    expect(page).toEqual({
      items: [{ ...ROW, createdAt: "2026-07-01T00:00:00.000Z" }],
      nextCursor: null,
    });
  });

  it("defaults to 20 when pagination is omitted entirely", async () => {
    const listActionLog = vi.fn().mockResolvedValue([]);
    const service = new ActionLogService({ listActionLog });

    await service.list();

    expect(listActionLog).toHaveBeenCalledWith({
      limit: 21,
      cursor: undefined,
    });
  });

  it("detects a further page and returns the last item's id as nextCursor", async () => {
    const rows = Array.from({ length: 3 }, (_, i) => ({
      ...ROW,
      id: `log-${i}`,
    }));
    const listActionLog = vi.fn().mockResolvedValue(rows);
    const service = new ActionLogService({ listActionLog });

    const page = await service.list({ limit: 2 });

    expect(page.items).toHaveLength(2);
    expect(page.nextCursor).toBe("log-1");
  });

  it("fails closed when a failed row contains a non-canonical reason", async () => {
    const listActionLog = vi.fn().mockResolvedValue([
      {
        ...ROW,
        status: "fail",
        reason: "raw database failure for private@example.com",
      },
    ]);
    const service = new ActionLogService({ listActionLog });

    await expect(service.list({ limit: 20 })).rejects.toThrow();
  });

  it("preserves a recognized failure classification", async () => {
    const listActionLog = vi
      .fn()
      .mockResolvedValue([{ ...ROW, status: "fail", reason: "CONFLICT" }]);
    const service = new ActionLogService({ listActionLog });

    const page = await service.list({ limit: 20 });

    expect(page.items[0]?.reason).toBe("CONFLICT");
  });

  it("fails closed when a repository row violates the public DTO", async () => {
    const listActionLog = vi
      .fn()
      .mockResolvedValue([{ ...ROW, role: "director" }]);
    const service = new ActionLogService({ listActionLog });

    await expect(service.list({ limit: 20 })).rejects.toThrow();
  });
});

describe("ActionLogPrismaRepository", () => {
  it("selects only the durable public allowlist", async () => {
    const findMany = vi.fn(
      (_query: { readonly select: Readonly<Record<string, boolean>> }) =>
        Promise.resolve([]),
    );
    const repository = new ActionLogPrismaRepository({
      userActionLog: { findMany },
    } as never);

    await repository.listActionLog({ limit: 21, cursor: "action-20" });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 21,
        skip: 1,
        cursor: { id: "action-20" },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        select: {
          id: true,
          createdAt: true,
          userId: true,
          role: true,
          procedure: true,
          targetId: true,
          status: true,
          reason: true,
          ip: true,
          correlationId: true,
          durationMs: true,
        },
      }),
    );
    expect(Object.keys(findMany.mock.calls[0]?.[0]?.select ?? {})).toHaveLength(
      11,
    );
  });
});
