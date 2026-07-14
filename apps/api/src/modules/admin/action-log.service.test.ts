import { describe, expect, it, vi } from "vitest";

import {
  type ActionLogRepository,
  ActionLogService,
} from "./action-log.service.js";

const ROW = {
  id: "log-1",
  userId: "user-1",
  role: "lead",
  procedure: "saveDraft",
  targetId: "sec-1",
  status: "success",
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
});
