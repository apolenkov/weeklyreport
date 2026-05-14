import { describe, it, expect } from "vitest";
import superjson from "superjson";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("superjson Date roundtrip (smoke)", () => {
  it("serializes and deserializes Date objects identically", () => {
    const original = new Date("2026-04-25T10:00:00Z");
    const serialized = superjson.serialize({ d: original });
    const deserialized = superjson.deserialize<{ d: Date }>(serialized);
    expect(deserialized.d).toBeInstanceOf(Date);
    expect(deserialized.d.getTime()).toBe(original.getTime());
  });

  it("matches the transformer config used in trpc.ts httpBatchLink", () => {
    const trpcSource = readFileSync(resolve(__dirname, "trpc.ts"), "utf8");
    expect(trpcSource).toContain("transformer: superjson");
  });
});
