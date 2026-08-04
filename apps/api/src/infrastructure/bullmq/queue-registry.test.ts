import type { Queue } from "bullmq";
import { describe, expect, it } from "vitest";

import { QUEUE_NAMES, QueueRegistry } from "./queue-registry.js";

const stubHandles = QUEUE_NAMES.map((name) => ({ name }) as Queue);

describe("QueueRegistry", () => {
  it("returns a distinct handle for each known queue name", () => {
    const registry = new QueueRegistry(stubHandles);

    const resolvedHandles = QUEUE_NAMES.map((name) => registry.get(name));

    expect(new Set(resolvedHandles).size).toBe(QUEUE_NAMES.length);
    for (const name of QUEUE_NAMES) {
      expect(registry.get(name).name).toBe(name);
    }
  });

  it("returns the same handle instance on repeated lookups", () => {
    const registry = new QueueRegistry(stubHandles);
    expect(registry.get("pdf-export")).toBe(registry.get("pdf-export"));
  });

  it("keeps get callable when detached", () => {
    const { get } = new QueueRegistry(stubHandles);

    expect(get("pdf-export")).toBe(stubHandles[1]);
  });

  it("rejects an incomplete BullModule handle set", () => {
    expect(() => new QueueRegistry(stubHandles.slice(1))).toThrow(
      `Expected ${QUEUE_NAMES.length} queue handles, received ${stubHandles.length - 1}`,
    );
  });
});
