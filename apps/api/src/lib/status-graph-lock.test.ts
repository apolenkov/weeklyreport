import type { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import { lockStatusGraph } from "./status-graph-lock.js";

describe("lockStatusGraph", () => {
  it("executes the void-returning advisory lock without query deserialization", async () => {
    const $executeRaw = vi.fn().mockResolvedValue(0);
    const tx = { $executeRaw } as unknown as Prisma.TransactionClient;

    await lockStatusGraph(tx);

    expect($executeRaw).toHaveBeenCalledOnce();
    const template = ($executeRaw.mock.calls as unknown[][])[0]?.[0];
    expect(template).toEqual(["\n    SELECT pg_advisory_xact_lock(", ")\n  "]);
  });
});
