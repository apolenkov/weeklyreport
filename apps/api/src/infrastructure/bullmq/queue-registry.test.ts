import { describe, expect, it, vi } from "vitest";

// Mock bullmq so constructing the registry attempts no Redis connection. Each
// Queue records the name it was built with and a close spy.
vi.mock("bullmq", () => ({
  Queue: class {
    readonly close = vi.fn().mockResolvedValue(undefined);
    constructor(readonly name: string) {}
  },
}));

import type { EnvConfig } from "../config/env.schema";
import { QUEUE_NAMES, QueueRegistry } from "./queue-registry.js";

// The Queue constructor is mocked above, so only the env shape matters.
const STUB_ENV = { REDIS_HOST: "localhost", REDIS_PORT: 6379 } as EnvConfig;

describe("QueueRegistry", () => {
  it("returns a distinct handle for each known queue name", () => {
    const registry = new QueueRegistry(STUB_ENV);

    const handles = QUEUE_NAMES.map((name) => registry.get(name));

    expect(new Set(handles).size).toBe(QUEUE_NAMES.length);
    for (const name of QUEUE_NAMES) {
      expect((registry.get(name) as unknown as { name: string }).name).toBe(
        name,
      );
    }
  });

  it("returns the same handle instance on repeated lookups", () => {
    const registry = new QueueRegistry(STUB_ENV);
    expect(registry.get("pdf-export")).toBe(registry.get("pdf-export"));
  });

  it("closes every queue handle on shutdown", async () => {
    const registry = new QueueRegistry(STUB_ENV);
    const closes = QUEUE_NAMES.map(
      (name) =>
        // eslint-disable-next-line vitest/unbound-method -- vi.fn() mock reference: the double cast erases the spy type, so the rule cannot see there is no `this` to lose
        registry.get(name).close as ReturnType<typeof vi.fn>,
    );

    await registry.onModuleDestroy();

    for (const close of closes) {
      expect(close).toHaveBeenCalledOnce();
    }
  });
});
