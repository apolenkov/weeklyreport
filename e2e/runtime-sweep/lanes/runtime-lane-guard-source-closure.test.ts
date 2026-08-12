import { describe, expect, it } from "vitest";

import {
  guardOnlySourceClosure,
  type GuardSourceReader,
} from "./runtime-lane-guard-source-closure.ts";

const ENTRY = new URL("file:///guard/entry.ts");

const sourceReader =
  (sources: Readonly<Record<string, string>>): GuardSourceReader =>
  (url) => {
    const source = sources[url.href];
    return source === undefined
      ? Promise.reject(new Error(`Missing fixture ${url.href}`))
      : Promise.resolve(source);
  };

describe("runtime lane guard-only source closure", () => {
  it("accepts both real guard-only command closures", async () => {
    const sources = await guardOnlySourceClosure(
      [
        "verify-runtime-lane-database-targets-cli.ts",
        "verify-runtime-lane-redis-targets-cli.ts",
      ].map((file) => new URL(file, import.meta.url)),
    );

    expect(sources.size).toBeGreaterThan(2);
  });

  it("ignores a type-only reference with no runtime capability", async () => {
    const sources = await guardOnlySourceClosure(
      [ENTRY],
      sourceReader({
        [ENTRY.href]:
          'import type { Socket } from "node:net"; export type Safe = Socket;',
      }),
    );

    expect(sources.size).toBe(1);
  });

  it("rejects a mutation capability in a local transitive module", async () => {
    const child = new URL("./child.ts", ENTRY);

    await expect(
      guardOnlySourceClosure(
        [ENTRY],
        sourceReader({
          [ENTRY.href]: 'import "./child.ts";',
          [child.href]:
            'process.getBuiltinModule("node:fs").writeFileSync("/tmp/x", "x");',
        }),
      ),
    ).rejects.toThrow();
  });

  it.each([
    'void import("node:net")',
    'const target = "node:net"; void import(target)',
    'require("ioredis")',
    'import child = require("node:child_process")',
    'import "side-effect-package"',
    'void fetch("https://example.test")',
    "process.kill(1)",
    'globalThis.fetch("https://example.test")',
    'new globalThis.WebSocket("ws://example.test")',
    'new globalThis.Worker("worker.js")',
    '(0, eval)("1")',
    'globalThis.Function("return process")',
    'process["kill"](1)',
    'process.getBuiltinModule("node:fs").writeFileSync("/tmp/x", "x")',
    'const load = require; load("node:fs")',
    '[].filter.constructor("return process")()',
  ])("rejects planted guard capability: %s", async (source) => {
    await expect(
      guardOnlySourceClosure([ENTRY], sourceReader({ [ENTRY.href]: source })),
    ).rejects.toThrow();
  });
});
