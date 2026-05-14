// Phase 54 (UFB-055): MockAiAdapter unit test. The mock is the only
// adapter implementation in this phase, so its deterministic shape is
// load-bearing for cache keys and UI badge logic downstream.
import { describe, expect, it } from "vitest";

import { MockAiAdapter } from "../mock-ai.adapter.js";
import { selectAiAdapter } from "../ai.module.js";

describe("MockAiAdapter (Phase 54 / UFB-055)", () => {
  it("emits the [mock-summary] sentinel with section count and period id", async () => {
    const adapter = new MockAiAdapter();
    const out = await adapter.generate("ignored", {
      periodId: "period-1",
      sections: [
        { sectionId: "s-a", authorName: "A", text: "a" },
        { sectionId: "s-b", authorName: "B", text: "b" },
      ],
    });
    expect(out).toBe("[mock-summary] 2 sections, period period-1");
  });

  it("is deterministic — same input → same output", async () => {
    const adapter = new MockAiAdapter();
    const input = { periodId: "p", sections: [] };
    const a = await adapter.generate("x", input);
    const b = await adapter.generate("x", input);
    expect(a).toBe(b);
  });

  it("ignores the prompt — content is content-free by design", async () => {
    const adapter = new MockAiAdapter();
    const a = await adapter.generate("foo", { periodId: "p", sections: [] });
    const b = await adapter.generate("bar", { periodId: "p", sections: [] });
    expect(a).toBe(b);
  });
});

describe("selectAiAdapter (Phase 54 / UFB-055)", () => {
  function withEnv<T>(provider: string | undefined, fn: () => T): T {
    const prev = process.env["AI_PROVIDER"];
    if (provider === undefined) delete process.env["AI_PROVIDER"];
    else process.env["AI_PROVIDER"] = provider;
    try {
      return fn();
    } finally {
      if (prev === undefined) delete process.env["AI_PROVIDER"];
      else process.env["AI_PROVIDER"] = prev;
    }
  }

  it("returns MockAiAdapter when AI_PROVIDER is unset", () => {
    const adapter = withEnv(undefined, () => selectAiAdapter());
    expect(adapter).toBeInstanceOf(MockAiAdapter);
  });

  it("returns MockAiAdapter when AI_PROVIDER=mock", () => {
    const adapter = withEnv("mock", () => selectAiAdapter());
    expect(adapter).toBeInstanceOf(MockAiAdapter);
  });

  it("throws with a clear message when AI_PROVIDER is anything else", () => {
    expect(() => withEnv("claude", () => selectAiAdapter())).toThrow(
      /AI provider not configured: claude/,
    );
  });
});
