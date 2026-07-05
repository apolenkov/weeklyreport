import { describe, expect, it, vi } from "vitest";

// Mock bullmq so constructing the Queue holder attempts no Redis connection.
vi.mock("bullmq", () => ({
  Queue: class {
    readonly close = vi.fn().mockResolvedValue(undefined);
  },
}));

import type { EnvConfig } from "../config/env.schema";
import { BullBoardQueues } from "./bull-board.module.js";

// The Queue constructor is mocked above, so only the env shape matters.
const STUB_ENV = { REDIS_HOST: "localhost", REDIS_PORT: 6379 } as EnvConfig;

describe("BullBoardQueues", () => {
  it("closes both Bull Board queue handles on shutdown", async () => {
    const holder = new BullBoardQueues(STUB_ENV);

    await holder.onModuleDestroy();

    // eslint-disable-next-line @typescript-eslint/unbound-method -- vitest spy assertion: reference to a vi.fn mock method, never invoked with a lost `this`
    expect(holder.pdfQueue.close).toHaveBeenCalledOnce();
    // eslint-disable-next-line @typescript-eslint/unbound-method -- vitest spy assertion: reference to a vi.fn mock method, never invoked with a lost `this`
    expect(holder.emailQueue.close).toHaveBeenCalledOnce();
  });
});
